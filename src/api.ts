export type Role = 'admin' | 'technician' | 'viewer';
export type User = { id: number; username: string; role: Role; guest?: boolean };
export type TeamMember = User & { active: number; created_at: string; last_login_at: string | null };
export type ArticleSummary = {
	id: number;
	title: string;
	category: string;
	clients: ClientRef[];
	updated_at: string;
	updated_by_name: string | null;
	snippet: string;
};
export type Article = ArticleSummary & {
	body: string;
	created_at: string;
	created_by_name: string | null;
	share_token?: string | null;
};
export type Client = {
	id: number;
	name: string;
	notes: string;
	new_hire: string;
	logo_image_id: string | null;
	article_count?: number;
};
export type Service = { name: string; on: boolean; category?: string };
export type ClientDetail = Client & { services: Service[]; articles: { id: number; title: string; category: string; updated_at: string }[] };
export type ClientRef = { id: number; name: string };
export type Overview = {
	counts: { articles: number; clients: number; users: number; internal: number; updated_30d: number };
	recent: { id: number; title: string; category: string; updated_at: string; clients: ClientRef[]; updated_by_name: string | null }[];
};

export type Accent = 'violet' | 'blue' | 'teal' | 'green' | 'orange' | 'rose' | 'slate';
export type Settings = { site_name: string; accent: Accent; logo_url: string | null; public_access: boolean };

export const imageUrl = (id: string | null | undefined) => (id ? `/api/images/${id}` : null);

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
