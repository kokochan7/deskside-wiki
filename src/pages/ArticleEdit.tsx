import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api, type Article, type Client } from '../api';
import { navigate, query } from '../router';
import { ClientPicker } from '../components/ClientPicker';
import { Button, Card, ErrorNote, Field, Select, Spinner, useFeedback } from '../components/ui';

// The editor is a big download, so only load it when someone actually edits.
const RichEditor = lazy(() => import('../components/RichEditor').then((m) => ({ default: m.RichEditor })));

type Form = { title: string; body: string; category: string; client_ids: number[] };

export function ArticleEdit({ id }: { id?: number }) {
	const { toast } = useFeedback();
	const copyFrom = id ? null : query().get('copy');
	const [form, setForm] = useState<Form | null>(
		id || copyFrom ? null : { title: '', body: '', category: 'General', client_ids: Number(query().get('client')) > 0 ? [Number(query().get('client'))] : [] },
	);
	const [initial, setInitial] = useState<string>('');
	const [categories, setCategories] = useState<string[]>([]);
	const [clients, setClients] = useState<Client[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const saveRef = useRef<() => void>(() => {});
	const [uploading, setUploading] = useState(0);

	useEffect(() => {
		api.get<string[]>('/categories').then(setCategories).catch(() => {});
		api.get<Client[]>('/clients').then(setClients).catch(() => {});
		if (id || copyFrom)
			api.get<Article>(`/articles/${id ?? copyFrom}`)
				.then((a) => {
					// Copying keeps every field so technicians only change what differs.
					const f = { title: id ? a.title : `${a.title} (copy)`, body: a.body, category: a.category, client_ids: a.clients.map((c) => c.id) };
					setForm(f);
					setInitial(JSON.stringify(f));
				})
				.catch((e) => setError(e.message));
		else setInitial(JSON.stringify(form));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	const dirty = form && JSON.stringify(form) !== initial;
	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [dirty]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
				e.preventDefault();
				saveRef.current();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	if (!form) return error ? <ErrorNote error={error} /> : <Spinner />;
	const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });

	const save = async () => {
		if (busy) return;
		if (uploading) {
			setError('Wait for the images to finish uploading.');
			return;
		}
		if (!form.title.trim()) {
			setError('Give the KB a title.');
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const payload = form;
			const res = id ? await api.put(`/articles/${id}`, payload) : await api.post('/articles', payload);
			setInitial(JSON.stringify(form));
			toast(id ? 'Changes saved' : 'KB created');
			navigate(`/articles/${res.id}`);
		} catch (e) {
			setError((e as Error).message);
			setBusy(false);
		}
	};
	saveRef.current = save;

	return (
		<>
			<button
				onClick={() => (id ? navigate(`/articles/${id}`) : history.length > 1 ? history.back() : navigate('/articles'))}
				className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
			>
				<ArrowLeft className="size-4" /> Cancel
			</button>
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
				<input
					value={form.title}
					onChange={(e) => set({ title: e.target.value })}
					placeholder="KB title"
					autoFocus={!id}
					className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
				/>
				<div className="flex items-center gap-2">
					{dirty && <span className="text-xs text-zinc-400">Unsaved changes</span>}
					<Button variant="primary" onClick={save} loading={busy}>
						{id ? 'Save changes' : 'Publish'}
					</Button>
				</div>
			</div>
			<div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[14rem_minmax(0,1fr)]">
				<Field label="Category">
					<Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
						{(categories.includes(form.category) ? categories : [form.category, ...categories]).map((c) => (
							<option key={c}>{c}</option>
						))}
					</Select>
				</Field>
				<div>
					<span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Clients</span>
					<ClientPicker clients={clients} value={form.client_ids} onChange={(client_ids) => set({ client_ids })} placeholder="Internal (no clients)" />
					{!form.client_ids.length && <span className="mt-1 block text-xs text-zinc-500">None selected: the KB is internal.</span>}
				</div>
			</div>
			<ErrorNote error={error} />
			<Card className="mt-4">
				<Suspense fallback={<Spinner />}>
					<RichEditor
						key={id ?? copyFrom ?? 'new'}
						value={form.body}
						onChange={(body) => setForm((f) => f && { ...f, body })}
						onUploadingChange={setUploading}
						placeholder="Write the steps, fixes and notes. Paste or drag in screenshots."
						className="min-h-[60vh]"
					/>
				</Suspense>
			</Card>
			<p className="mt-2 text-xs text-zinc-400">Paste, drag in or upload images. Press Ctrl/⌘ + S to save. Don't store passwords in KBs.</p>
		</>
	);
}
