export type Role = 'admin' | 'technician' | 'viewer';
export type User = { id: number; email: string; name: string; role: Role };
export type TeamMember = User & { active: number; created_at: string; last_login_at: string | null };
export type ArticleSummary = {
	id: number;
	title: string;
	category: string;
	tags: string;
	client_id: number | null;
	client_name: string | null;
	updated_at: string;
	updated_by_name: string | null;
	snippet: string;
};
export type Article = ArticleSummary & {
	body: string;
	created_at: string;
	created_by_name: string | null;
};
export type Contact = { id: number; client_id: number; name: string; title: string; email: string; phone: string; notes: string };
export type Client = {
	id: number;
	name: string;
	website: string;
	phone: string;
	email: string;
	address: string;
	notes: string;
	contact_count?: number;
	article_count?: number;
};
export type ClientDetail = Client & { contacts: Contact[]; articles: { id: number; title: string; category: string; updated_at: string }[] };
export type Overview = {
	counts: { articles: number; clients: number; contacts: number; users: number };
	recent: { id: number; title: string; category: string; updated_at: string; client_name: string | null; updated_by_name: string | null }[];
	categories: { category: string; count: number }[];
};

export class ApiError extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

export let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function request<T>(method: string, path: string, data?: unknown): Promise<T> {
	const res = await fetch('/api' + path, {
		method,
		credentials: 'same-origin',
		headers: { 'X-Requested-With': 'deskside', ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
		body: data !== undefined ? JSON.stringify(data) : undefined,
	});
	const json = (await res.json().catch(() => ({}))) as { error?: string };
	if (!res.ok) {
		if (res.status === 401 && !path.startsWith('/login') && !path.startsWith('/me/password')) onUnauthorized();
		throw new ApiError(res.status, json.error ?? `Request failed (${res.status}).`);
	}
	return json as T;
}

export const api = {
	get: <T>(path: string) => request<T>('GET', path),
	post: <T = { id: number }>(path: string, data: unknown = {}) => request<T>('POST', path, data),
	put: <T = { id: number }>(path: string, data: unknown) => request<T>('PUT', path, data),
	del: <T = { ok: true }>(path: string) => request<T>('DELETE', path),
};
