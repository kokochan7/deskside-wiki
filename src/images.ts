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
export async function prepareImage(file: Blob, maxSide = MAX_SIDE): Promise<Blob> {
	const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
	if (!ok.includes(file.type)) throw new Error('Only PNG, JPEG, WebP, GIF and SVG images are supported.');
	const img = await loadImage(file);
	if (file.type === 'image/svg+xml') return rasterizeSvg(img, maxSide);
	const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
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

// SVGs can carry scripts, so they're turned into a PNG in the browser and never stored as SVG.
async function rasterizeSvg(img: HTMLImageElement, maxSide: number): Promise<Blob> {
	const w0 = img.naturalWidth || maxSide;
	const h0 = img.naturalHeight || maxSide;
	const scale = maxSide / Math.max(w0, h0);
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(w0 * scale);
	canvas.height = Math.round(h0 * scale);
	canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
	const blob = await toBlob(canvas, 'image/png');
	if (!blob) throw new Error("That SVG couldn't be converted.");
	return blob;
}

// Logos: cut away empty margins (transparent, or the plain colour around the edges) so the logo itself fills its
// box, and keep it as a PNG so transparency survives.
export async function trimLogo(file: Blob, maxSide = 512): Promise<Blob> {
	const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
	if (!ok.includes(file.type)) throw new Error('Only PNG, JPEG, WebP, GIF and SVG images are supported.');
	const img = await loadImage(file);
	const w0 = img.naturalWidth || maxSide;
	const h0 = img.naturalHeight || maxSide;
	// Work at a decent size: shrink big images, and draw SVGs (no fixed size) large enough to stay sharp.
	const scale = file.type === 'image/svg+xml' ? maxSide / Math.max(w0, h0) : Math.min(1, (maxSide * 2) / Math.max(w0, h0));
	const src = document.createElement('canvas');
	src.width = Math.max(1, Math.round(w0 * scale));
	src.height = Math.max(1, Math.round(h0 * scale));
	const g = src.getContext('2d', { willReadFrequently: true })!;
	g.drawImage(img, 0, 0, src.width, src.height);
	const { data, width, height } = g.getImageData(0, 0, src.width, src.height);

	// The top-left pixel stands for the background: either transparent, or a colour (usually white).
	const [br, bg, bb, ba] = data;
	const isBackground = (i: number) =>
		ba < 16 ? data[i + 3] < 16 : data[i + 3] < 16 || Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) < 36;
	let top = height, left = width, bottom = -1, right = -1;
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++)
			if (!isBackground((y * width + x) * 4)) {
				if (y < top) top = y;
				if (y > bottom) bottom = y;
				if (x < left) left = x;
				if (x > right) right = x;
			}
	// Nothing but background: keep the whole image.
	if (bottom < 0) [top, left, bottom, right] = [0, 0, height - 1, width - 1];
	// A little breathing room, then fit within maxSide.
	const pad = Math.round(Math.max(right - left, bottom - top) * 0.04);
	left = Math.max(0, left - pad);
	top = Math.max(0, top - pad);
	right = Math.min(width - 1, right + pad);
	bottom = Math.min(height - 1, bottom + pad);
	const cw = right - left + 1;
	const ch = bottom - top + 1;
	const fit = Math.min(1, maxSide / Math.max(cw, ch));
	const out = document.createElement('canvas');
	out.width = Math.max(1, Math.round(cw * fit));
	out.height = Math.max(1, Math.round(ch * fit));
	out.getContext('2d')!.drawImage(src, left, top, cw, ch, 0, 0, out.width, out.height);
	const blob = await toBlob(out, 'image/png');
	if (!blob) throw new Error("That logo couldn't be processed.");
	return blob.size <= MAX_BYTES ? blob : prepareImage(blob, maxSide);
}

export async function uploadImage(file: Blob, maxSide = MAX_SIDE, logo = false): Promise<{ id: string; url: string }> {
	const blob = logo ? await trimLogo(file, maxSide) : await prepareImage(file, maxSide);
	const res = await fetch('/api/images', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'X-Requested-With': 'deskside', 'Content-Type': blob.type },
		body: blob,
	});
	const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: string };
	if (!res.ok || !json.id || !json.url) throw new ApiError(res.status, json.error ?? `Upload failed (${res.status}).`);
	return { id: json.id, url: json.url };
}

// "Screenshot 2026-10-11 at 9.41.png" -> "Screenshot 2026-10-11 at 9.41"
export const altText = (file: File | Blob) =>
	(('name' in file && file.name) || 'image').replace(/\.[a-z0-9]+$/i, '').replace(/[[\]]/g, '');
