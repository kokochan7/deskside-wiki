const ITERATIONS = 100_000; // Workers caps PBKDF2 at 100k iterations.
const enc = new TextEncoder();

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await derive(password, salt, ITERATIONS);
	return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [scheme, iter, salt, hash] = stored.split('$');
	if (scheme !== 'pbkdf2') return false;
	const actual = new Uint8Array(await derive(password, fromB64(salt), Number(iter)));
	const expected = fromB64(hash);
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}

export function newSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Sessions are stored by the SHA-256 of their token so a leaked database can't be used to log in.
export async function hashToken(token: string): Promise<string> {
	return toB64(await crypto.subtle.digest('SHA-256', enc.encode(token)));
}
