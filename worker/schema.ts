// The app creates and upgrades its own tables, so a fresh D1 database needs no manual setup.
// To change the schema, append a new entry to MIGRATIONS. Never edit an entry that has shipped.
const MIGRATIONS: string[][] = [
	[
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE COLLATE NOCASE,
			name TEXT NOT NULL,
			role TEXT NOT NULL CHECK (role IN ('admin', 'technician', 'viewer')),
			password_hash TEXT NOT NULL,
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			last_login_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS clients (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			website TEXT NOT NULL DEFAULT '',
			phone TEXT NOT NULL DEFAULT '',
			email TEXT NOT NULL DEFAULT '',
			address TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS contacts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			email TEXT NOT NULL DEFAULT '',
			phone TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS articles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			body TEXT NOT NULL DEFAULT '',
			category TEXT NOT NULL DEFAULT 'General',
			tags TEXT NOT NULL DEFAULT '',
			client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
			created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
			updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE INDEX IF NOT EXISTS idx_articles_client ON articles(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id)`,
		`CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(title, body, tags, content='articles', content_rowid='id')`,
		`CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
			INSERT INTO articles_fts(rowid, title, body, tags) VALUES (new.id, new.title, new.body, new.tags);
		END`,
		`CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
			INSERT INTO articles_fts(articles_fts, rowid, title, body, tags) VALUES ('delete', old.id, old.title, old.body, old.tags);
		END`,
		`CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
			INSERT INTO articles_fts(articles_fts, rowid, title, body, tags) VALUES ('delete', old.id, old.title, old.body, old.tags);
			INSERT INTO articles_fts(rowid, title, body, tags) VALUES (new.id, new.title, new.body, new.tags);
		END`,
	],
	[
		// Images pasted or uploaded into articles. Stored in D1 so no extra Cloudflare setup is needed;
		// the browser shrinks them before upload to stay under D1's 2 MB value limit.
		`CREATE TABLE IF NOT EXISTS images (
			id TEXT PRIMARY KEY,
			content_type TEXT NOT NULL,
			size INTEGER NOT NULL,
			data BLOB NOT NULL,
			created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
	],
	[
		// Client logos and site-wide branding (name, logo, accent colour) set by admins.
		`ALTER TABLE clients ADD COLUMN logo_image_id TEXT`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
	],
	[
		// Public share links for single articles.
		`ALTER TABLE articles ADD COLUMN share_token TEXT`,
		`CREATE UNIQUE INDEX IF NOT EXISTS articles_share_token ON articles (share_token)`,
	],
	[
		// An article can belong to several clients. articles.client_id is no longer used after this.
		`CREATE TABLE IF NOT EXISTS article_clients (
			article_id INTEGER NOT NULL,
			client_id INTEGER NOT NULL,
			PRIMARY KEY (article_id, client_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_article_clients_client ON article_clients (client_id)`,
		`INSERT OR IGNORE INTO article_clients (article_id, client_id) SELECT id, client_id FROM articles WHERE client_id IS NOT NULL`,
		// Categories are a fixed list that admins manage.
		`CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY COLLATE NOCASE)`,
		`INSERT OR IGNORE INTO categories (name) VALUES ('General'), ('Networking'), ('Microsoft 365'), ('Hardware'), ('Printers'), ('Security'), ('Onboarding')`,
		`INSERT OR IGNORE INTO categories (name) SELECT DISTINCT category FROM articles`,
		// Sign in with a username instead of an email. Existing accounts get the part of their email before the @,
		// with the user id added if two people would end up with the same name.
		`ALTER TABLE users RENAME COLUMN email TO username`,
		`CREATE TABLE username_map AS SELECT id, lower(substr(username, 1, instr(username, '@') - 1)) AS base FROM users WHERE instr(username, '@') > 1`,
		`UPDATE users SET username = (
			SELECT m.base || CASE WHEN EXISTS (SELECT 1 FROM username_map o WHERE o.base = m.base AND o.id < m.id) THEN m.id ELSE '' END
			FROM username_map m WHERE m.id = users.id
		) WHERE id IN (SELECT id FROM username_map)`,
		`DROP TABLE username_map`,
	],
	[
		// Admins set the order categories appear in. Start from alphabetical.
		`ALTER TABLE categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0`,
		`UPDATE categories SET position = (SELECT COUNT(*) FROM categories k WHERE k.name < categories.name COLLATE NOCASE)`,
		// Accounts are identified by username alone; the name column now just mirrors it.
		`UPDATE users SET name = username`,
	],
];

let ready: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
	ready ??= migrate(db).catch((err) => {
		ready = null;
		throw err;
	});
	return ready;
}

async function migrate(db: D1Database) {
	await db.prepare(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`).run();
	const row = await db.prepare(`SELECT MAX(version) AS v FROM schema_version`).first<{ v: number | null }>();
	const current = row?.v ?? 0;
	for (let i = current; i < MIGRATIONS.length; i++) {
		await db.batch([
			...MIGRATIONS[i].map((sql) => db.prepare(sql)),
			db.prepare(`INSERT INTO schema_version (version) VALUES (?)`).bind(i + 1),
		]);
	}
}
