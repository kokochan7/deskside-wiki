import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, ImagePlus, Loader2, Pencil } from 'lucide-react';
import { api } from '../api';
import { altText, uploadImage } from '../images';
import { Button, Card, ErrorNote, Markdown, cx, useFeedback } from './ui';

// A Markdown section on a client page (Information, New hire procedure). Everyone reads it; admins edit it in place.
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
	const [preview, setPreview] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(0);
	const textarea = useRef<HTMLTextAreaElement>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const uploadSeq = useRef(0);
	const editing = draft !== null;

	useEffect(() => {
		if (!editing || draft === text) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [editing, draft, text]);

	const start = () => {
		setDraft(text);
		setPreview(false);
		setError(null);
		requestAnimationFrame(() => textarea.current?.focus());
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

	// Same approach as the KB editor: a placeholder at the cursor, swapped for the link once uploaded.
	const insertImages = async (files: File[]) => {
		const images = files.filter((f) => f.type.startsWith('image/'));
		if (!images.length) return;
		const pos = textarea.current?.selectionEnd ?? draft?.length ?? 0;
		const tokens = images.map(() => `![Uploading image ${++uploadSeq.current}…]()`);
		setDraft((d) => (d ?? '').slice(0, pos) + tokens.map((t) => `\n${t}\n`).join('') + (d ?? '').slice(pos));
		const swap = (token: string, value: string) => setDraft((d) => d && d.replace(token, value));
		setUploading((n) => n + images.length);
		await Promise.all(
			images.map(async (file, i) => {
				try {
					swap(tokens[i], `![${altText(file)}](${(await uploadImage(file)).url})`);
				} catch (e) {
					swap(tokens[i], '');
					toast((e as Error).message, 'error');
				} finally {
					setUploading((n) => n - 1);
				}
			}),
		);
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
				{editing && (
					<div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
						{[false, true].map((p) => (
							<button
								key={String(p)}
								type="button"
								onClick={() => setPreview(p)}
								className={cx('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', preview === p ? 'bg-white shadow-xs dark:bg-zinc-900' : 'text-zinc-500')}
							>
								{p ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
								{p ? 'Preview' : 'Write'}
							</button>
						))}
					</div>
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
					{preview ? (
						<div className="min-h-48 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
							{draft!.trim() ? <Markdown source={draft!} className="prose-sm" /> : <p className="text-sm text-zinc-400">Nothing to preview yet.</p>}
						</div>
					) : (
						<textarea
							ref={textarea}
							value={draft!}
							onChange={(e) => setDraft(e.target.value)}
							onPaste={(e) => {
								const files = Array.from(e.clipboardData.files);
								if (!files.some((f) => f.type.startsWith('image/')) || e.clipboardData.getData('text/plain').trim()) return;
								e.preventDefault();
								insertImages(files);
							}}
							onDrop={(e) => {
								const files = Array.from(e.dataTransfer.files);
								if (!files.length) return;
								e.preventDefault();
								insertImages(files);
							}}
							onKeyDown={(e) => {
								if ((e.ctrlKey || e.metaKey) && e.key === 's') {
									e.preventDefault();
									save();
								}
								if (e.key === 'Escape' && draft === text) setDraft(null);
							}}
							placeholder={placeholder}
							rows={12}
							className="min-h-48 w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 font-mono text-sm leading-relaxed outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900"
						/>
					)}
					<ErrorNote error={error} />
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-brand-600">
							<ImagePlus className="size-4" /> Add image
						</button>
						{uploading > 0 && (
							<span className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-300">
								<Loader2 className="size-3 animate-spin" /> Uploading…
							</span>
						)}
						<span className="hidden text-xs text-zinc-400 sm:inline">Markdown supported. Don't store passwords here.</span>
						<div className="ml-auto flex gap-2">
							<Button size="sm" type="button" onClick={() => setDraft(null)}>
								Cancel
							</Button>
							<Button size="sm" variant="primary" loading={busy} onClick={save}>
								Save
							</Button>
						</div>
					</div>
					<input
						ref={fileInput}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif"
						multiple
						hidden
						onChange={(e) => {
							insertImages(Array.from(e.target.files ?? []));
							e.target.value = '';
						}}
					/>
				</>
			)}
		</Card>
	);
}
