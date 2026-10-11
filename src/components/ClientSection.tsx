import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../api';
import { Button, Card, ErrorNote, Markdown, Spinner, useFeedback } from './ui';

const RichEditor = lazy(() => import('./RichEditor').then((m) => ({ default: m.RichEditor })));

// A rich text section on a client page (Information, New hire procedure). Everyone reads it; admins edit it in place.
export function ClientSection({
	clientId,
	section,
	title,
	icon,
	text,
	canEdit,
	empty,
	placeholder,
	onSaved,
}: {
	clientId: number;
	section: 'info' | 'new-hire';
	title: string;
	icon: ReactNode;
	text: string;
	canEdit: boolean;
	empty: string;
	placeholder: string;
	onSaved: (text: string) => void;
}) {
	const { toast } = useFeedback();
	const [draft, setDraft] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(0);
	const editing = draft !== null;

	useEffect(() => {
		if (!editing || draft === text) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [editing, draft, text]);

	const start = () => {
		setDraft(text);
		setError(null);
	};
	const save = async () => {
		if (uploading) return setError('Wait for the images to finish uploading.');
		setBusy(true);
		setError(null);
		try {
			await api.put(`/clients/${clientId}/sections/${section}`, { text: draft });
			onSaved(draft!.trim());
			setDraft(null);
			toast(`${title} saved`);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card className="p-5">
			<div className="mb-3 flex items-center gap-2">
				<span className="text-brand-500">{icon}</span>
				<h2 className="flex-1 font-semibold">{title}</h2>
				{canEdit && !editing && (
					<Button size="sm" variant="ghost" onClick={start}>
						<Pencil className="size-4" /> Edit
					</Button>
				)}
			</div>

			{!editing ? (
				text ? (
					<Markdown source={text} className="prose-sm" />
				) : (
					<p className="text-sm text-zinc-500">{empty}</p>
				)
			) : (
				<>
					<div
						className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
						onKeyDown={(e) => {
							if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
								e.preventDefault();
								save();
							}
						}}
					>
						<Suspense fallback={<Spinner />}>
							<RichEditor value={text} onChange={setDraft} onUploadingChange={setUploading} placeholder={placeholder} autoFocus compact className="min-h-56" />
						</Suspense>
					</div>
					<ErrorNote error={error} />
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<span className="hidden text-xs text-zinc-400 sm:inline">Paste or drag in screenshots. Don't store passwords here.</span>
						<div className="ml-auto flex gap-2">
							<Button size="sm" type="button" onClick={() => setDraft(null)}>
								Cancel
							</Button>
							<Button size="sm" variant="primary" loading={busy} onClick={save}>
								Save
							</Button>
						</div>
					</div>
				</>
			)}
		</Card>
	);
}
