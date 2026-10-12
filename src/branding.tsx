import { createContext, useContext, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api, type Accent, type Settings } from './api';
import { uploadImage } from './images';
import { Button, cx, useFeedback } from './components/ui';
import { initials } from './format';

export const DEFAULT_SETTINGS: Settings = { site_name: 'Deskside KB', accent: 'violet', logo_url: null, public_access: false };

// Shades 50–900 for each accent the admin can pick. Applied as Tailwind's --color-brand-* variables.
export const ACCENTS: Record<Accent, string[]> = {
	violet: ['#f1efff', '#e3e0ff', '#c9c3ff', '#a99fff', '#8a7cff', '#6d5dfc', '#5546e0', '#4335b5', '#352b8a', '#1f1a4d'],
	blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
	teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a'],
	green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'],
	orange: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'],
	rose: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337'],
	slate: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
};
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export function applyBranding(s: Settings) {
	const root = document.documentElement.style;
	(ACCENTS[s.accent] ?? ACCENTS.violet).forEach((hex, i) => root.setProperty(`--color-brand-${STEPS[i]}`, hex));
	document.title = s.site_name;
	const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (icon) {
		icon.href = s.logo_url ?? '/favicon.svg';
		icon.type = s.logo_url ? '' : 'image/svg+xml';
	}
}

export async function loadBranding(): Promise<Settings> {
	const s = await api.get<Settings>('/settings').catch(() => DEFAULT_SETTINGS);
	applyBranding(s);
	return s;
}

export const BrandingCtx = createContext<{ settings: Settings; reload: () => Promise<void> }>({ settings: DEFAULT_SETTINGS, reload: async () => {} });
export const useBranding = () => useContext(BrandingCtx);

// The site logo, or the default mark when none is uploaded.
export function BrandMark({ className }: { className?: string }) {
	const { settings } = useBranding();
	return <img src={settings.logo_url ?? '/favicon.svg'} alt="" className={cx('object-contain', className)} />;
}

const sizes = { sm: 'size-6 text-[10px] rounded-md', md: 'size-10 text-sm rounded-lg', lg: 'size-14 text-lg rounded-xl' };

// A logo sits on a transparent background, scaled up or down to fit the box whole, whatever its shape.
export function ClientLogo({ name, logoUrl, size = 'md' }: { name: string; logoUrl: string | null; size?: keyof typeof sizes }) {
	if (logoUrl)
		return (
			<span className={cx('relative shrink-0', sizes[size])}>
				<img src={logoUrl} alt="" className="absolute inset-0 size-full object-contain" />
			</span>
		);
	return (
		<span
			className={cx(
				'grid shrink-0 place-items-center bg-gradient-to-br from-brand-100 to-brand-200 font-semibold text-brand-700 dark:from-brand-500/20 dark:to-brand-500/30 dark:text-brand-200',
				sizes[size],
			)}
		>
			{initials(name) || '?'}
		</span>
	);
}

// Upload / replace / remove a logo. Calls onChange with the stored image id (or null).
export function LogoPicker({ url, onChange, label = 'Upload logo' }: { url: string | null; onChange: (id: string | null, url: string | null) => void; label?: string }) {
	const { toast } = useFeedback();
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const pick = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		try {
			// Logos are trimmed of empty margins so they fill their box.
			const res = await uploadImage(file, 512, true);
			onChange(res.id, res.url);
		} catch (e) {
			toast((e as Error).message, 'error');
		}
		setBusy(false);
	};
	return (
		<div className="flex items-center gap-4">
			<span className="relative grid size-16 shrink-0 place-items-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
				{busy ? <Loader2 className="size-5 animate-spin text-zinc-400" /> : url ? <img src={url} alt="" className="absolute inset-1 size-[calc(100%-0.5rem)] object-contain" /> : <ImagePlus className="size-5 text-zinc-400" />}
			</span>
			<div className="flex flex-wrap gap-2">
				<Button type="button" size="sm" onClick={() => input.current?.click()} disabled={busy}>
					{url ? 'Replace' : label}
				</Button>
				{url && (
					<Button type="button" size="sm" variant="ghost" onClick={() => onChange(null, null)} className="hover:text-red-600">
						<Trash2 className="size-4" /> Remove
					</Button>
				)}
				<p className="w-full text-xs text-zinc-500">PNG, JPG, WebP or SVG. Empty margins are trimmed automatically.</p>
			</div>
			<input
				ref={input}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
				hidden
				onChange={(e) => {
					pick(e.target.files?.[0]);
					e.target.value = '';
				}}
			/>
		</div>
	);
}
