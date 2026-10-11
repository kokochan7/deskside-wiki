import { useEffect, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { api, type Accent } from '../api';
import { ACCENTS, applyBranding, LogoPicker, useBranding } from '../branding';
import { Button, Card, ErrorNote, Field, Input, PageHeader, cx, useFeedback } from '../components/ui';
import { CategorySettings } from './CategorySettings';

export function SiteSettings() {
	const { settings, reload } = useBranding();
	const { toast } = useFeedback();
	const logoId = (url: string | null) => url?.split('/').pop() ?? null;
	const [f, setF] = useState({
		site_name: settings.site_name,
		accent: settings.accent,
		logo_image_id: logoId(settings.logo_url),
		logo_url: settings.logo_url,
		public_access: settings.public_access,
	});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Preview colour and name live; put the saved branding back if the admin leaves without saving.
	useEffect(() => {
		applyBranding({ ...f, site_name: f.site_name || settings.site_name });
	}, [f, settings.site_name]);
	useEffect(() => () => void reload(), [reload]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await api.put('/settings', { site_name: f.site_name, accent: f.accent, logo_image_id: f.logo_image_id, public_access: f.public_access });
			await reload();
			toast('Settings saved');
		} catch (err) {
			setError((err as Error).message);
		}
		setBusy(false);
	};

	return (
		<div className="max-w-2xl space-y-6">
			<PageHeader
				title="Settings"
				actions={
					<Button variant="primary" form="site-settings" loading={busy}>
						Save settings
					</Button>
				}
			/>
			{/* Only the branding fields need the form; Access is read from state when saving, so it can sit below Categories. */}
			<form id="site-settings" onSubmit={submit} className="space-y-6">
				<ErrorNote error={error} />
				<Card className="space-y-5 p-5">
					<h2 className="font-semibold">Branding</h2>
					<Field label="Site name" hint="Shown in the sidebar, the browser tab and on the sign-in page.">
						<Input required maxLength={60} value={f.site_name} onChange={(e) => setF({ ...f, site_name: e.target.value })} />
					</Field>
					<div>
						<span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Logo</span>
						<LogoPicker url={f.logo_url} onChange={(id, url) => setF({ ...f, logo_image_id: id, logo_url: url })} />
						<p className="mt-2 text-xs text-zinc-500">Also used as the browser tab icon. Without a logo, the default icon is shown.</p>
					</div>
					<div>
						<span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Accent color</span>
						<div className="flex flex-wrap gap-2">
							{(Object.keys(ACCENTS) as Accent[]).map((a) => (
								<button
									key={a}
									type="button"
									onClick={() => setF({ ...f, accent: a })}
									title={a[0].toUpperCase() + a.slice(1)}
									aria-label={a}
									aria-pressed={f.accent === a}
									className={cx(
										'grid size-9 place-items-center rounded-full ring-offset-2 transition dark:ring-offset-zinc-900',
										f.accent === a ? 'ring-2 ring-zinc-900 dark:ring-white' : 'hover:scale-110',
									)}
									style={{ background: ACCENTS[a][5] }}
								>
									{f.accent === a && <Check className="size-4 text-white" />}
								</button>
							))}
						</div>
					</div>
				</Card>
			</form>

			<CategorySettings />

			<Card className="space-y-3 p-5">
				<h2 className="font-semibold">Access</h2>
				<label className="flex items-start gap-3 text-sm">
					<input
						type="checkbox"
						checked={f.public_access}
						onChange={(e) => setF({ ...f, public_access: e.target.checked })}
						className="mt-0.5 size-4 accent-brand-600"
					/>
					<span>
						<span className="font-medium">Let anyone view without signing in</span>
						<span className="mt-0.5 block text-zinc-500">
							Visitors can read every KB and client page, read-only. Anyone with the site address can see them, so turn this off if
							KBs contain anything sensitive. Signing in is still needed to make changes. Share links for single KBs work
							either way.
						</span>
					</span>
				</label>
			</Card>
		</div>
	);
}
