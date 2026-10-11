import { ApiError } from './api';

const MAX_BYTES = 1_900_000; // must match the server limit (D1 values max out at 2 MB)
const MAX_SIDE = 2400;

const loadImage = (file: Blob) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("That file couldn't be read as an image."));
		};
		img.src = url;
	});

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
	new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// Shrink big screenshots and photos so they upload fast and fit the server limit.
// Small PNG/JPEG/WebP/GIF files are uploaded untouched (GIFs keep their animation).
export async function prepareImage(file: Blob): Promise<Blob> {
	const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
	if (!ok.includes(file.type)) throw new Error('Only PNG, JPEG, WebP and GIF images are supported.');
	const img = await loadImage(file);
	const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
	if (file.size <= 800_000 && scale === 1) return file;
	if (file.type === 'image/gif' && file.size <= MAX_BYTES) return file;

	const canvas = document.createElement('canvas');
	let w = Math.round(img.naturalWidth * scale);
	let h = Math.round(img.naturalHeight * scale);
	for (let attempt = 0; attempt < 5; attempt++) {
		canvas.width = w;
		canvas.height = h;
		canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
		// Screenshots stay crisp as WebP; quality steps down only if still too big.
		const blob = (await toBlob(canvas, 'image/webp', 0.9 - attempt * 0.1)) ?? (await toBlob(canvas, 'image/jpeg', 0.85 - attempt * 0.1));
		if (blob && blob.size <= MAX_BYTES) return blob;
		w = Math.round(w * 0.8);
		h = Math.round(h * 0.8);
	}
	throw new Error('That image is too large, even after compressing it.');
}

export async function uploadImage(file: Blob): Promise<string> {
	const blob = await prepareImage(file);
	const res = await fetch('/api/images', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'X-Requested-With': 'deskside', 'Content-Type': blob.type },
		body: blob,
	});
	const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
	if (!res.ok || !json.url) throw new ApiError(res.status, json.error ?? `Upload failed (${res.status}).`);
	return json.url;
}

// "Screenshot 2026-10-11 at 9.41.png" -> "Screenshot 2026-10-11 at 9.41"
export const altText = (file: File | Blob) =>
	(('name' in file && file.name) || 'image').replace(/\.[a-z0-9]+$/i, '').replace(/[[\]]/g, '');
