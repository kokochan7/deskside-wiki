import { Hono, type Context, type Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { ensureSchema } from './schema';
import { hashPassword, verifyPassword, newSessionToken, hashToken } from './auth';

type Role = 'admin' | 'technician' | 'viewer';
type User = { id: number; email: string; name: string; role: Role };
type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher }; Variables: { user: User } };

const SESSION_COOKIE = 'kb_session';
const SESSION_DAYS = 30;
const ROLES: Role[] = ['admin', 'technician', 'viewer'];

const app = new Hono<Env>().basePath('/api');

app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	console.error(err);
	return c.json({ error: 'Something went wrong on the server.' }, 500);
});

const fail = (status: 400 | 401 | 403 | 404 | 409, message: string): never => {
	throw new HTTPException(status, { message });
};

// Every request: make sure tables exist; block cross-site writes.
app.use('*', async (c, next) => {
	await ensureSchema(c.env.DB);
	if (c.req.method !== 'GET' && c.req.header('X-Requested-With') !== 'deskside') fail(403, 'Bad request origin.');
	await next();
});

// ---------- helpers ----------

async function body<T = Record<string, unknown>>(c: Context): Promise<T> {
	try {
		return await c.req.json<T>();
	} catch {
		return fail(400, 'Invalid request body.');
	}
}

function str(v: unknown, field: string, { required = false, max = 200 } = {}): string {
	const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
	if (required && !s) fail(400, `${field} is required.`);
	if (s.length > max) fail(400, `${field} is too long (max ${max} characters).`);
	return s;
}

function email(v: unknown): string {
	const s = str(v, 'Email', { required: true }).toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail(400, 'Enter a valid email address.');
	return s;
}

function password(v: unknown): string {
	const s = typeof v === 'string' ? v : '';
	if (s.length < 10) fail(400, 'Password must be at least 10 characters.');
	if (s.length > 200) fail(400, 'Password is too long.');
	return s;
}

function idParam(c: Context): number {
	const id = Number(c.req.param('id'));
	if (!Number.isInteger(id) || id <= 0) fail(404, 'Not found.');
	return id;
}

async function startSession(c: Context<Env>, userId: number) {
	const token = newSessionToken();
	const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
	await c.env.DB.batch([
		c.env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`),
		c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(
			await hashToken(token),
			userId,
			expires.toISOString().replace('T', ' ').slice(0, 19),
		),
		c.env.DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).bind(userId),
	]);
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		secure: new URL(c.req.url).protocol === 'https:',
		sameSite: 'Lax',
		path: '/',
		expires,
	});
}

const requireUser = async (c: Context<Env>, next: Next) => {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) fail(401, 'Please sign in.');
	const user = await c.env.DB.prepare(
		`SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.id = ? AND s.expires_at > datetime('now') AND u.active = 1`,
	)
		.bind(await hashToken(token!))
		.first<User>();
	if (!user) fail(401, 'Your session has expired. Please sign in again.');
	c.set('user', user!);
	await next();
};

const requireRole =
	(...roles: Role[]) =>
	async (c: Context<Env>, next: Next) => {
		if (!roles.includes(c.get('user').role)) fail(403, "You don't have permission to do that.");
		await next();
	};
const canEdit = requireRole('admin', 'technician');
const adminOnly = requireRole('admin');

// ---------- setup & sessions ----------

const userCount = async (db: D1Database) =>
	(await db.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>())!.n;

app.get('/setup', async (c) => c.json({ needsSetup: (await userCount(c.env.DB)) === 0 }));

// Creates the first admin. Only works while there are no users at all.
app.post('/setup', async (c) => {
	const b = await body(c);
	const name = str(b.name, 'Name', { required: true });
	const mail = email(b.email);
	const hash = await hashPassword(password(b.password));
	const res = await c.env.DB.prepare(
		`INSERT INTO users (email, name, role, password_hash)
		 SELECT ?, ?, 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
	)
		.bind(mail, name, hash)
		.run();
	if (!res.meta.changes) fail(409, 'Setup has already been completed. Please sign in.');
	await startSession(c, res.meta.last_row_id);
	return c.json({ ok: true });
});

app.post('/login', async (c) => {
	const b = await body(c);
	const mail = str(b.email, 'Email', { required: true }).toLowerCase();
	const pw = typeof b.password === 'string' ? b.password : '';
	const user = await c.env.DB.prepare(`SELECT id, password_hash, active FROM users WHERE email = ?`)
		.bind(mail)
		.first<{ id: number; password_hash: string; active: number }>();
	const ok = user ? await verifyPassword(pw, user.password_hash) : await verifyPassword(pw, DUMMY_HASH);
	if (!user || !ok || !user.active) fail(401, 'Incorrect email or password.');
	await startSession(c, user!.id);
	return c.json({ ok: true });
});
// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

app.post('/logout', async (c) => {
	const token = getCookie(c, SESSION_COOKIE);
	if (token) await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(await hashToken(token)).run();
	deleteCookie(c, SESSION_COOKIE, { path: '/' });
	return c.json({ ok: true });
});

// ---------- branding (readable before sign-in so the login page can show it) ----------

const ACCENTS = ['violet', 'blue', 'teal', 'green', 'orange', 'rose', 'slate'];
const DEFAULT_SETTINGS = { site_name: 'Deskside KB', accent: 'violet', logo_image_id: '' };
type Settings = typeof DEFAULT_SETTINGS;

async function getSettings(db: D1Database): Promise<Settings> {
	const { results } = await db.prepare(`SELECT key, value FROM settings`).all<{ key: keyof Settings; value: string }>();
	const s = { ...DEFAULT_SETTINGS };
	for (const r of results) if (r.key in s) s[r.key] = r.value;
	return s;
}

app.get('/settings', async (c) => {
	const s = await getSettings(c.env.DB);
	return c.json({ site_name: s.site_name, accent: s.accent, logo_url: s.logo_image_id ? `/api/settings/logo/${s.logo_image_id}` : null });
});

// The site logo is public (it appears on the sign-in page); every other image needs a session.
app.get('/settings/logo/:id', async (c) => {
	const s = await getSettings(c.env.DB);
	if (!s.logo_image_id || c.req.param('id') !== s.logo_image_id) fail(404, 'Logo not found.');
	return serveImage(c.env.DB, s.logo_image_id, 'public, max-age=31536000, immutable');
});

async function serveImage(db: D1Database, id: string, cacheControl: string) {
	if (!/^[0-9a-f]{32}$/.test(id)) fail(404, 'Image not found.');
	const row = await db.prepare(`SELECT content_type, data FROM images WHERE id = ?`)
		.bind(id)
		.first<{ content_type: string; data: number[] | ArrayBuffer }>();
	if (!row) fail(404, 'Image not found.');
	return new Response(new Uint8Array(row!.data), {
		headers: {
			'Content-Type': row!.content_type,
			'Cache-Control': cacheControl,
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "default-src 'none'",
		},
	});
}

async function imageIdOrNull(db: D1Database, v: unknown): Promise<string | null> {
	if (v == null || v === '') return null;
	const id = String(v);
	if (!/^[0-9a-f]{32}$/.test(id) || !(await db.prepare(`SELECT 1 FROM images WHERE id = ?`).bind(id).first()))
		fail(400, 'That image no longer exists. Please upload it again.');
	return id;
}

// Everything below needs a signed-in user.
app.use('*', requireUser);

app.get('/me', (c) => c.json(c.get('user')));

app.put('/me/password', async (c) => {
	const b = await body(c);
	const row = await c.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`)
		.bind(c.get('user').id)
		.first<{ password_hash: string }>();
	if (!row || !(await verifyPassword(String(b.currentPassword ?? ''), row.password_hash)))
		fail(400, 'Your current password is incorrect.');
	const hash = await hashPassword(password(b.newPassword));
	const token = getCookie(c, SESSION_COOKIE)!;
	// Sign out every other session for this user.
	await c.env.DB.batch([
		c.env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(hash, c.get('user').id),
		c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND id != ?`).bind(c.get('user').id, await hashToken(token)),
	]);
	return c.json({ ok: true });
});

// ---------- overview ----------

app.get('/overview', async (c) => {
	const db = c.env.DB;
	const [counts, recent, categories] = await db.batch([
		db.prepare(
			`SELECT (SELECT COUNT(*) FROM articles) AS articles, (SELECT COUNT(*) FROM clients) AS clients,
			        (SELECT COUNT(*) FROM users WHERE active = 1) AS users`,
		),
		db.prepare(
			`SELECT a.id, a.title, a.category, a.updated_at, c.name AS client_name, u.name AS updated_by_name
			 FROM articles a LEFT JOIN clients c ON c.id = a.client_id LEFT JOIN users u ON u.id = a.updated_by
			 ORDER BY a.updated_at DESC LIMIT 8`,
		),
		db.prepare(`SELECT category, COUNT(*) AS count FROM articles GROUP BY category ORDER BY count DESC, category`),
	]);
	return c.json({ counts: counts.results[0], recent: recent.results, categories: categories.results });
});

// ---------- articles ----------

function ftsQuery(q: string): string {
	// Turn free text into a prefix search: "vpn reset" -> "vpn"* "reset"*
	return q
		.split(/\s+/)
		.map((t) => t.replace(/"/g, ''))
		.filter(Boolean)
		.map((t) => `"${t}"*`)
		.join(' ');
}

app.get('/articles', async (c) => {
	const q = str(c.req.query('q'), 'Search');
	const category = c.req.query('category');
	const client = c.req.query('client');
	const where: string[] = [];
	const args: unknown[] = [];
	let from = 'articles a';
	let order = 'a.updated_at DESC';
	let snippet = `substr(a.body, 1, 200)`;
	if (q && ftsQuery(q)) {
		from = 'articles_fts f JOIN articles a ON a.id = f.rowid';
		where.push('articles_fts MATCH ?');
		args.push(ftsQuery(q));
		order = 'bm25(articles_fts, 10.0, 1.0, 5.0)';
		snippet = `snippet(articles_fts, 1, '<mark>', '</mark>', '…', 24)`;
	}
	if (category) {
		where.push('a.category = ?');
		args.push(category);
	}
	if (client === 'none') where.push('a.client_id IS NULL');
	else if (client) {
		where.push('a.client_id = ?');
		args.push(Number(client));
	}
	const sql = `SELECT a.id, a.title, a.category, a.tags, a.client_id, a.updated_at, ${snippet} AS snippet,
		c.name AS client_name, u.name AS updated_by_name
		FROM ${from} LEFT JOIN clients c ON c.id = a.client_id LEFT JOIN users u ON u.id = a.updated_by
		${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 200`;
	const { results } = await c.env.DB.prepare(sql).bind(...args).all();
	return c.json(results);
});

app.get('/categories', async (c) => {
	const { results } = await c.env.DB.prepare(`SELECT DISTINCT category FROM articles ORDER BY category`).all<{ category: string }>();
	return c.json(results.map((r) => r.category));
});

app.get('/articles/:id', async (c) => {
	const row = await c.env.DB.prepare(
		`SELECT a.*, c.name AS client_name, cu.name AS created_by_name, uu.name AS updated_by_name
		 FROM articles a LEFT JOIN clients c ON c.id = a.client_id
		 LEFT JOIN users cu ON cu.id = a.created_by LEFT JOIN users uu ON uu.id = a.updated_by WHERE a.id = ?`,
	)
		.bind(idParam(c))
		.first();
	if (!row) fail(404, 'Article not found.');
	return c.json(row);
});

async function articleFields(c: Context<Env>) {
	const b = await body(c);
	const clientId = b.client_id ? Number(b.client_id) : null;
	if (clientId && !(await c.env.DB.prepare(`SELECT 1 FROM clients WHERE id = ?`).bind(clientId).first()))
		fail(400, 'That client no longer exists.');
	return {
		title: str(b.title, 'Title', { required: true }),
		body: str(b.body, 'Article body', { max: 200_000 }),
		category: str(b.category, 'Category', { max: 60 }) || 'General',
		tags: str(b.tags, 'Tags', { max: 300 })
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean)
			.join(', '),
		client_id: clientId,
	};
}

app.post('/articles', canEdit, async (c) => {
	const f = await articleFields(c);
	const uid = c.get('user').id;
	const res = await c.env.DB.prepare(
		`INSERT INTO articles (title, body, category, tags, client_id, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(f.title, f.body, f.category, f.tags, f.client_id, uid, uid)
		.run();
	return c.json({ id: res.meta.last_row_id }, 201);
});

app.put('/articles/:id', canEdit, async (c) => {
	const id = idParam(c);
	const f = await articleFields(c);
	const res = await c.env.DB.prepare(
		`UPDATE articles SET title = ?, body = ?, category = ?, tags = ?, client_id = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
	)
		.bind(f.title, f.body, f.category, f.tags, f.client_id, c.get('user').id, id)
		.run();
	if (!res.meta.changes) fail(404, 'Article not found.');
	return c.json({ id });
});

app.delete('/articles/:id', canEdit, async (c) => {
	const res = await c.env.DB.prepare(`DELETE FROM articles WHERE id = ?`).bind(idParam(c)).run();
	if (!res.meta.changes) fail(404, 'Article not found.');
	return c.json({ ok: true });
});

// ---------- images ----------

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 1_900_000; // D1 values max out at 2 MB.

app.post('/images', canEdit, async (c) => {
	const type = (c.req.header('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
	if (!IMAGE_TYPES.includes(type)) fail(400, 'Only PNG, JPEG, WebP and GIF images are supported.');
	const data = await c.req.arrayBuffer();
	if (!data.byteLength) fail(400, 'The image is empty.');
	if (data.byteLength > MAX_IMAGE_BYTES) fail(400, 'That image is too large (max 1.9 MB after compression).');
	const id = crypto.randomUUID().replace(/-/g, '');
	await c.env.DB.prepare(`INSERT INTO images (id, content_type, size, data, created_by) VALUES (?, ?, ?, ?, ?)`)
		.bind(id, type, data.byteLength, data, c.get('user').id)
		.run();
	return c.json({ id, url: `/api/images/${id}` }, 201);
});

// Images never change once uploaded; only signed-in users can fetch them.
app.get('/images/:id', (c) => serveImage(c.env.DB, c.req.param('id'), 'private, max-age=31536000, immutable'));

// ---------- clients ----------

app.get('/clients', async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT c.*, (SELECT COUNT(*) FROM articles WHERE client_id = c.id) AS article_count
		 FROM clients c ORDER BY c.name COLLATE NOCASE`,
	).all();
	return c.json(results);
});

app.get('/clients/:id', async (c) => {
	const id = idParam(c);
	const db = c.env.DB;
	const [client, articles] = await db.batch([
		db.prepare(`SELECT * FROM clients WHERE id = ?`).bind(id),
		db.prepare(`SELECT id, title, category, updated_at FROM articles WHERE client_id = ? ORDER BY updated_at DESC`).bind(id),
	]);
	if (!client.results[0]) fail(404, 'Client not found.');
	return c.json({ ...(client.results[0] as object), articles: articles.results });
});

async function clientFields(c: Context<Env>) {
	const b = await body(c);
	return {
		name: str(b.name, 'Client name', { required: true }),
		website: str(b.website, 'Website'),
		phone: str(b.phone, 'Phone', { max: 60 }),
		email: str(b.email, 'Email'),
		address: str(b.address, 'Address', { max: 500 }),
		notes: str(b.notes, 'Notes', { max: 20_000 }),
		logo_image_id: await imageIdOrNull(c.env.DB, b.logo_image_id),
	};
}

app.post('/clients', canEdit, async (c) => {
	const f = await clientFields(c);
	const res = await c.env.DB.prepare(
		`INSERT INTO clients (name, website, phone, email, address, notes, logo_image_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(f.name, f.website, f.phone, f.email, f.address, f.notes, f.logo_image_id)
		.run();
	return c.json({ id: res.meta.last_row_id }, 201);
});

app.put('/clients/:id', canEdit, async (c) => {
	const id = idParam(c);
	const f = await clientFields(c);
	const res = await c.env.DB.prepare(
		`UPDATE clients SET name = ?, website = ?, phone = ?, email = ?, address = ?, notes = ?, logo_image_id = ?, updated_at = datetime('now') WHERE id = ?`,
	)
		.bind(f.name, f.website, f.phone, f.email, f.address, f.notes, f.logo_image_id, id)
		.run();
	if (!res.meta.changes) fail(404, 'Client not found.');
	return c.json({ id });
});

app.delete('/clients/:id', canEdit, async (c) => {
	const id = idParam(c);
	// D1 doesn't enforce foreign keys by default, so clean up children explicitly.
	const db = c.env.DB;
	const [res] = await db.batch([
		db.prepare(`DELETE FROM clients WHERE id = ?`).bind(id),
		db.prepare(`DELETE FROM contacts WHERE client_id = ?`).bind(id),
		db.prepare(`UPDATE articles SET client_id = NULL WHERE client_id = ?`).bind(id),
	]);
	if (!res.meta.changes) fail(404, 'Client not found.');
	return c.json({ ok: true });
});

// ---------- settings (admin only) ----------

app.put('/settings', adminOnly, async (c) => {
	const b = await body(c);
	const site_name = str(b.site_name, 'Site name', { required: true, max: 60 });
	const accent = String(b.accent ?? 'violet');
	if (!ACCENTS.includes(accent)) fail(400, 'Choose one of the listed colours.');
	const logo = (await imageIdOrNull(c.env.DB, b.logo_image_id)) ?? '';
	const put = c.env.DB.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
	await c.env.DB.batch([put.bind('site_name', site_name), put.bind('accent', accent), put.bind('logo_image_id', logo)]);
	return c.json({ ok: true });
});

// ---------- team (admin only) ----------

app.get('/users', adminOnly, async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT id, email, name, role, active, created_at, last_login_at FROM users ORDER BY name COLLATE NOCASE`,
	).all();
	return c.json(results);
});

function role(v: unknown): Role {
	if (!ROLES.includes(v as Role)) fail(400, 'Choose a valid role.');
	return v as Role;
}

app.post('/users', adminOnly, async (c) => {
	const b = await body(c);
	const f = { name: str(b.name, 'Name', { required: true }), email: email(b.email), role: role(b.role) };
	const hash = await hashPassword(password(b.password));
	if (await c.env.DB.prepare(`SELECT 1 FROM users WHERE email = ?`).bind(f.email).first())
		fail(409, 'Someone with that email already has an account.');
	const res = await c.env.DB.prepare(`INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)`)
		.bind(f.email, f.name, f.role, hash)
		.run();
	return c.json({ id: res.meta.last_row_id }, 201);
});

async function otherActiveAdmins(db: D1Database, id: number) {
	return (await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?`).bind(id).first<{ n: number }>())!.n;
}

app.put('/users/:id', adminOnly, async (c) => {
	const id = idParam(c);
	const b = await body(c);
	const f = { name: str(b.name, 'Name', { required: true }), email: email(b.email), role: role(b.role), active: b.active === false ? 0 : 1 };
	if ((f.role !== 'admin' || !f.active) && (await otherActiveAdmins(c.env.DB, id)) === 0)
		fail(400, 'There must always be at least one active admin.');
	if (await c.env.DB.prepare(`SELECT 1 FROM users WHERE email = ? AND id != ?`).bind(f.email, id).first())
		fail(409, 'Someone else already uses that email.');
	const stmts = [c.env.DB.prepare(`UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?`).bind(f.name, f.email, f.role, f.active, id)];
	if (b.password) stmts.push(c.env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(await hashPassword(password(b.password)), id));
	if (b.password || !f.active) stmts.push(c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id));
	const [res] = await c.env.DB.batch(stmts);
	if (!res.meta.changes) fail(404, 'User not found.');
	return c.json({ id });
});

app.delete('/users/:id', adminOnly, async (c) => {
	const id = idParam(c);
	if (id === c.get('user').id) fail(400, "You can't delete your own account.");
	if ((await otherActiveAdmins(c.env.DB, id)) === 0) fail(400, 'There must always be at least one active admin.');
	const db = c.env.DB;
	const [res] = await db.batch([
		db.prepare(`DELETE FROM users WHERE id = ?`).bind(id),
		db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
	]);
	if (!res.meta.changes) fail(404, 'User not found.');
	return c.json({ ok: true });
});

app.all('*', (c) => c.json({ error: 'Not found.' }, 404));

export default {
	fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname.startsWith('/api/')) return app.fetch(request, env, ctx);
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env['Bindings']>;
