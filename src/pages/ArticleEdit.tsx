import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bold, Code, Columns2, Eye, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Pencil, Quote, Table } from 'lucide-react';
import { api, type Article, type Client } from '../api';
import { navigate, query } from '../router';
import { Button, Card, ErrorNote, Field, Input, Markdown, Select, Spinner, cx, useFeedback } from '../components/ui';

const TEMPLATES: Record<string, string> = {
	'How-to': `## Overview\n\nWhat this guide helps you do.\n\n## Steps\n\n1. First step\n2. Second step\n3. Third step\n\n## Verify\n\nHow to confirm it worked.\n`,
	Troubleshooting: `## Symptoms\n\n- What the user sees\n- Error message: \`...\`\n\n## Cause\n\nWhy it happens.\n\n## Fix\n\n1. Step one\n2. Step two\n\n## If that doesn't work\n\n- Escalate to ...\n`,
	Runbook: `## When to use\n\nTrigger or alert that starts this runbook.\n\n## Prerequisites\n\n- [ ] Access to ...\n- [ ] Credentials stored in ...\n\n## Procedure\n\n1. ...\n2. ...\n\n## Rollback\n\n1. ...\n\n## Contacts\n\n| Role | Name | Phone |\n| --- | --- | --- |\n| Vendor support | | |\n`,
	'Client setup notes': `## Environment\n\n| Item | Details |\n| --- | --- |\n| Internet provider | |\n| Firewall | |\n| Wi-Fi SSIDs | |\n| Servers | |\n| Backups | |\n\n## Access\n\nWhere credentials are stored (never paste passwords here).\n\n## Notes\n\n- \n`,
};

type Form = { title: string; body: string; category: string; tags: string; client_id: string };

export function ArticleEdit({ id }: { id?: number }) {
	const { toast } = useFeedback();
	const [form, setForm] = useState<Form | null>(id ? null : { title: '', body: '', category: '', tags: '', client_id: query().get('client') ?? '' });
	const [initial, setInitial] = useState<string>('');
	const [categories, setCategories] = useState<string[]>([]);
	const [clients, setClients] = useState<Client[]>([]);
	const [view, setView] = useState<'split' | 'write' | 'preview'>(() => (window.innerWidth >= 1024 ? 'split' : 'write'));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const textarea = useRef<HTMLTextAreaElement>(null);
	const saveRef = useRef<() => void>(() => {});

	useEffect(() => {
		api.get<string[]>('/categories').then(setCategories).catch(() => {});
		api.get<Client[]>('/clients').then(setClients).catch(() => {});
		if (id)
			api.get<Article>(`/articles/${id}`)
				.then((a) => {
					const f = { title: a.title, body: a.body, category: a.category, tags: a.tags, client_id: a.client_id ? String(a.client_id) : '' };
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
		if (!form.title.trim()) {
			setError('Give the article a title.');
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const payload = { ...form, client_id: form.client_id ? Number(form.client_id) : null };
			const res = id ? await api.put(`/articles/${id}`, payload) : await api.post('/articles', payload);
			setInitial(JSON.stringify(form));
			toast(id ? 'Changes saved' : 'Article created');
			navigate(`/articles/${res.id}`);
		} catch (e) {
			setError((e as Error).message);
			setBusy(false);
		}
	};
	saveRef.current = save;

	// Wrap the selection (or insert at the cursor) with markdown syntax.
	const wrap = (before: string, after = '', placeholder = '') => {
		const ta = textarea.current!;
		const { selectionStart: s, selectionEnd: e, value } = ta;
		const sel = value.slice(s, e) || placeholder;
		const next = value.slice(0, s) + before + sel + after + value.slice(e);
		set({ body: next });
		requestAnimationFrame(() => {
			ta.focus();
			ta.setSelectionRange(s + before.length, s + before.length + sel.length);
		});
	};
	const linePrefix = (prefix: string) => {
		const ta = textarea.current!;
		const { selectionStart: s, selectionEnd: e, value } = ta;
		const start = value.lastIndexOf('\n', s - 1) + 1;
		const block = value.slice(start, e) || '';
		const lines = block.split('\n').map((l, i) => (prefix === '1. ' ? `${i + 1}. ` : prefix) + l);
		set({ body: value.slice(0, start) + lines.join('\n') + value.slice(e) });
		requestAnimationFrame(() => ta.focus());
	};

	const tools = [
		{ icon: Heading2, label: 'Heading', run: () => linePrefix('## ') },
		{ icon: Bold, label: 'Bold', run: () => wrap('**', '**', 'bold text') },
		{ icon: Italic, label: 'Italic', run: () => wrap('_', '_', 'italic text') },
		{ icon: Code, label: 'Code', run: () => wrap('`', '`', 'code') },
		{ icon: Link2, label: 'Link', run: () => wrap('[', '](https://)', 'link text') },
		{ icon: List, label: 'Bulleted list', run: () => linePrefix('- ') },
		{ icon: ListOrdered, label: 'Numbered list', run: () => linePrefix('1. ') },
		{ icon: ListChecks, label: 'Checklist', run: () => linePrefix('- [ ] ') },
		{ icon: Quote, label: 'Quote', run: () => linePrefix('> ') },
		{ icon: Table, label: 'Table', run: () => wrap('\n| Column | Column |\n| --- | --- |\n| ', ' | |\n', 'Value') },
	];

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
					placeholder="Article title"
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
			<div className="mb-4 grid gap-3 sm:grid-cols-3">
				<Field label="Category">
					<Input list="categories" value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Networking" />
					<datalist id="categories">
						{['General', 'Networking', 'Microsoft 365', 'Hardware', 'Printers', 'Security', 'Onboarding', ...categories]
							.filter((v, i, a) => a.indexOf(v) === i)
							.map((c) => (
								<option key={c} value={c} />
							))}
					</datalist>
				</Field>
				<Field label="Client">
					<Select value={form.client_id} onChange={(e) => set({ client_id: e.target.value })}>
						<option value="">Internal (all clients)</option>
						{clients.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Tags" hint="Separate with commas.">
					<Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="vpn, fortinet" />
				</Field>
			</div>
			<ErrorNote error={error} />
			<Card className="mt-4 overflow-hidden">
				<div className="flex flex-wrap items-center gap-1 border-b border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
					{view !== 'preview' &&
						tools.map((t) => (
							<button
								key={t.label}
								type="button"
								onClick={t.run}
								title={t.label}
								aria-label={t.label}
								className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
							>
								<t.icon className="size-4" />
							</button>
						))}
					{!form.body && (
						<Select
							value=""
							onChange={(e) => e.target.value && set({ body: TEMPLATES[e.target.value] })}
							className="ml-1 h-8! w-auto text-xs"
							aria-label="Start from a template"
						>
							<option value="">Start from a template…</option>
							{Object.keys(TEMPLATES).map((t) => (
								<option key={t}>{t}</option>
							))}
						</Select>
					)}
					<div className="ml-auto flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
						{(
							[
								['write', Pencil, 'Write'],
								['split', Columns2, 'Split'],
								['preview', Eye, 'Preview'],
							] as const
						).map(([v, Icon, label]) => (
							<button
								key={v}
								onClick={() => setView(v)}
								className={cx(
									'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
									v === 'split' && 'hidden lg:flex',
									view === v ? 'bg-white shadow-xs dark:bg-zinc-900' : 'text-zinc-500',
								)}
							>
								<Icon className="size-3.5" />
								{label}
							</button>
						))}
					</div>
				</div>
				<div className={cx('grid', view === 'split' && 'lg:grid-cols-2 lg:divide-x divide-zinc-100 dark:divide-zinc-800')}>
					{view !== 'preview' && (
						<textarea
							ref={textarea}
							value={form.body}
							onChange={(e) => set({ body: e.target.value })}
							placeholder={'Write in Markdown…\n\n## Steps\n1. Open the admin portal\n2. ...'}
							spellCheck
							className="min-h-[60vh] w-full resize-y bg-transparent p-5 font-mono text-sm leading-relaxed outline-none placeholder:text-zinc-400"
						/>
					)}
					{view !== 'write' && (
						<div className="min-h-[60vh] overflow-auto p-5">
							{form.body.trim() ? <Markdown source={form.body} /> : <p className="text-sm text-zinc-400">Nothing to preview yet.</p>}
						</div>
					)}
				</div>
			</Card>
			<p className="mt-2 text-xs text-zinc-400">Markdown supported. Press Ctrl/⌘ + S to save. Don't store passwords in articles.</p>
		</>
	);
}
