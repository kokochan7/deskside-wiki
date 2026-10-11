// D1 stores UTC as "YYYY-MM-DD HH:MM:SS".
const parse = (s: string) => new Date(s.replace(' ', 'T') + 'Z');

export function timeAgo(s: string | null | undefined): string {
	if (!s) return 'never';
	const sec = (Date.now() - parse(s).getTime()) / 1000;
	if (sec < 60) return 'just now';
	const units: [number, string][] = [
		[60, 'minute'],
		[3600, 'hour'],
		[86400, 'day'],
		[2592000, 'month'],
		[31536000, 'year'],
	];
	let [div, name] = units[0];
	for (const u of units) if (sec >= u[0]) [div, name] = u;
	const n = Math.floor(sec / div);
	return `${n} ${name}${n === 1 ? '' : 's'} ago`;
}

export const fullDate = (s: string | null | undefined) =>
	s ? parse(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

export const initials = (name: string) =>
	name
		.split(/[\s._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join('');

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
