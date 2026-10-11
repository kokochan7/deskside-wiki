import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Building2, ExternalLink, FilePlus2, Layers, PencilLine, Search, Trash2 } from 'lucide-react';
import { api, imageUrl, type ArticleSummary, type Client, type Overview } from '../api';
import { ClientLogo } from '../branding';
import { timeAgo } from '../format';
import { navigate, query } from '../router';
import { canEdit, useUser } from '../session';
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, cx, useFeedback } from '../components/ui';
import { ClientPicker } from '../components/ClientPicker';

export function ArticleList() {
	const user = useUser();
	const [q, setQ] = useState(() => query().get('q') ?? '');
	const [category, setCategory] = useState(() => query().get('category') ?? '');
	const [client, setClient] = useState(() => query().get('client') ?? '');
	const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
	const [categories, setCategories] = useState<string[]>([]);
	const [clients, setClients] = useState<Client[]>([]);
	const [counts, setCounts] = useState({ articles: 0, internal: 0 });
	const [clientFilter, setClientFilter] = useState('');
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [reload, setReload] = useState(0);
	const isAdmin = user.role === 'admin';
	const selectable = canEdit(user);
	const [bulkEditing, setBulkEditing] = useState(false);
	const { confirm, toast } = useFeedback();

	useEffect(() => {
		api.get<string[]>('/categories').then(setCategories).catch(() => {});
		api.get<Client[]>('/clients').then(setClients).catch(() => {});
		api.get<Overview>('/overview').then((o) => setCounts(o.counts)).catch(() => {});
	}, [reload]);

	useEffect(() => {
		const params = new URLSearchParams();
		if (q.trim()) params.set('q', q.trim());
		if (category) params.set('category', category);
		if (client) params.set('client', client);
		history.replaceState(null, '', `#/articles${params.size ? '?' + params : ''}`);
		const t = setTimeout(() => {
			api.get<ArticleSummary[]>(`/articles?${params}`).then(setArticles).catch(() => setArticles([]));
		}, 150);
		return () => clearTimeout(t);
	}, [q, category, client, reload]);
	// Only keep selections that are still visible after filtering.
	useEffect(() => setSelected((s) => new Set(articles?.filter((a) => s.has(a.id)).map((a) => a.id))), [articles]);

	const current = clients.find((c) => String(c.id) === client);
	const toggle = (id: number) =>
		setSelected((s) => {
			const next = new Set(s);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	const allSelected = !!articles?.length && articles.every((a) => selected.has(a.id));
	const deleteSelected = async () => {
		const n = selected.size;
		if (!(await confirm(`Delete ${n} article${n === 1 ? '' : 's'}?`, "They'll be permanently deleted. This can't be undone.", 'Delete'))) return;
		try {
			await api.post('/articles/delete', { ids: [...selected] });
			toast(`${n} article${n === 1 ? '' : 's'} deleted`);
			setSelected(new Set());
			setReload((r) => r + 1);
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};
	const shownClients = useMemo(
		() => clients.filter((c) => c.name.toLowerCase().includes(clientFilter.toLowerCase())),
		[clients, clientFilter],
	);

	const sideItem = (key: string, label: string, count: number, icon: React.ReactNode) => (
		<button
			key={key}
			onClick={() => setClient(key)}
			className={cx(
				'flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition lg:w-full',
				client === key
					? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
					: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60',
			)}
		>
			{icon}
			<span className="min-w-0 flex-1 truncate">{label}</span>
			<span className="text-xs tabular-nums text-zinc-400">{count}</span>
		</button>
	);

	return (
		<>
			<PageHeader
				title="Knowledge base"
				actions={
					canEdit(user) && (
						<Button variant="primary" onClick={() => navigate(`/articles/new${client && client !== 'none' ? `?client=${client}` : ''}`)}>
							<FilePlus2 className="size-4" /> Create New KB
						</Button>
					)
				}
			/>
			<div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
				<aside className="lg:sticky lg:top-6 lg:self-start">
					<div className="mb-2 flex items-center justify-between px-1">
						<h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Clients</h2>
					</div>
					{clients.length > 8 && (
						<Input value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} placeholder="Find a client…" className="mb-2 h-8! text-xs" />
					)}
					<nav className="flex max-h-56 flex-col gap-0.5 overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
						{sideItem('', 'All articles', counts.articles, <Layers className="size-6 shrink-0 p-1 text-zinc-400" />)}
						{sideItem('none', 'Internal', counts.internal, <Building2 className="size-6 shrink-0 p-1 text-zinc-400" />)}
						{shownClients.length > 0 && <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-800" />}
						{shownClients.map((c) =>
							sideItem(String(c.id), c.name, c.article_count ?? 0, <ClientLogo name={c.name} logoUrl={imageUrl(c.logo_image_id)} size="sm" />),
						)}
					</nav>
				</aside>

				<section className="min-w-0">
					{current && (
						<div className="mb-4 flex items-center gap-3">
							<ClientLogo name={current.name} logoUrl={imageUrl(current.logo_image_id)} size="md" />
							<h2 className="text-lg font-semibold">{current.name}</h2>
							<a href={`#/clients/${current.id}`} className="ml-1 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-brand-600">
								Client details <ExternalLink className="size-3" />
							</a>
						</div>
					)}
					<div className="mb-3 flex flex-col gap-2 sm:flex-row">
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
							<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" className="pl-9" autoFocus />
						</div>
						<Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48" aria-label="Category">
							<option value="">All categories</option>
							{categories.map((c) => (
								<option key={c}>{c}</option>
							))}
						</Select>
					</div>

					{!articles ? (
						<Spinner />
					) : articles.length === 0 ? (
						<Empty icon={<BookOpen className="size-5" />} title={q || category ? 'No matching articles' : 'No articles here yet'}>
							{q || category ? 'Try a different search or clear the filters.' : 'Create an article to get started.'}
						</Empty>
					) : (
						<Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
							{selectable && (
								<div className="flex items-center gap-3 bg-zinc-50/80 px-4 py-2 text-xs text-zinc-500 dark:bg-zinc-900/60">
									<input
										type="checkbox"
										checked={allSelected}
										onChange={() => setSelected(allSelected ? new Set() : new Set(articles.map((a) => a.id)))}
										className="size-4 accent-brand-600"
										aria-label="Select all"
									/>
									{selected.size ? (
										<>
											<span className="font-medium text-zinc-700 dark:text-zinc-300">{selected.size} selected</span>
											<Button size="sm" onClick={() => setBulkEditing(true)} className="ml-auto h-7!">
												<PencilLine className="size-3.5" /> Change category or clients
											</Button>
											{isAdmin && (
												<Button size="sm" variant="danger" onClick={deleteSelected} className="h-7!">
													<Trash2 className="size-3.5" /> Delete
												</Button>
											)}
										</>
									) : (
										<span>Select articles to change {isAdmin ? 'or delete ' : ''}several at once</span>
									)}
								</div>
							)}
							{articles.map((a) => (
								<div key={a.id} className={cx('group flex items-center text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40', selected.has(a.id) && 'bg-brand-50/60 dark:bg-brand-500/10')}>
									{selectable && (
										<input
											type="checkbox"
											checked={selected.has(a.id)}
											onChange={() => toggle(a.id)}
											className="ml-4 size-4 shrink-0 accent-brand-600"
											aria-label={`Select ${a.title}`}
										/>
									)}
									<a href={`#/articles/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
										<span className="min-w-0 flex-1 truncate font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{a.title}</span>
										{!client && a.clients.length > 0 && (
											<span className="hidden max-w-56 truncate text-xs text-zinc-500 sm:inline" title={a.clients.map((c) => c.name).join(', ')}>
												{a.clients.map((c) => c.name).join(', ')}
											</span>
										)}
										<Badge>{a.category}</Badge>
										<span className="hidden w-24 shrink-0 text-right text-xs text-zinc-400 md:inline">{timeAgo(a.updated_at)}</span>
									</a>
								</div>
							))}
						</Card>
					)}
					{articles && articles.length > 0 && (
						<p className="mt-2 px-1 text-xs text-zinc-400">
							{articles.length} article{articles.length === 1 ? '' : 's'}
						</p>
					)}
				</section>
			</div>
			<BulkEdit
				open={bulkEditing}
				ids={[...selected]}
				categories={categories}
				clients={clients}
				onClose={() => setBulkEditing(false)}
				onDone={() => {
					setBulkEditing(false);
					setReload((r) => r + 1);
				}}
			/>
		</>
	);
}


type ClientMode = '' | 'add' | 'remove' | 'set';

function BulkEdit({ open, ids, categories, clients, onClose, onDone }: { open: boolean; ids: number[]; categories: string[]; clients: Client[]; onClose: () => void; onDone: () => void }) {
	const { toast } = useFeedback();
	const [category, setCategory] = useState('');
	const [mode, setMode] = useState<ClientMode>('');
	const [clientIds, setClientIds] = useState<number[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (!open) return;
		setCategory('');
		setMode('');
		setClientIds([]);
		setError(null);
		setBusy(false);
	}, [open]);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await api.post('/articles/bulk-update', { ids, category: category || undefined, clients: mode ? { mode, ids: clientIds } : undefined });
			toast(`${ids.length} article${ids.length === 1 ? '' : 's'} updated`);
			onDone();
		} catch (err) {
			setError((err as Error).message);
			setBusy(false);
		}
	};
	const modes: [ClientMode, string][] = [
		['', "Don't change"],
		['add', 'Add clients'],
		['remove', 'Remove clients'],
		['set', 'Replace with'],
	];
	const nothing = !category && !mode;

	return (
		<Modal open={open} onClose={onClose} title={`Change ${ids.length} article${ids.length === 1 ? '' : 's'}`}>
			<form onSubmit={save} className="space-y-5">
				<Field label="Category">
					<Select value={category} onChange={(e) => setCategory(e.target.value)}>
						<option value="">Don't change</option>
						{categories.map((c) => (
							<option key={c}>{c}</option>
						))}
					</Select>
				</Field>
				<div>
					<span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Clients</span>
					<div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
						{modes.map(([m, label]) => (
							<button
								key={m}
								type="button"
								onClick={() => setMode(m)}
								className={cx('flex-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap', mode === m ? 'bg-white shadow-xs dark:bg-zinc-900' : 'text-zinc-500')}
							>
								{label}
							</button>
						))}
					</div>
					{mode && <ClientPicker clients={clients} value={clientIds} onChange={setClientIds} placeholder={mode === 'set' ? 'No clients (make them internal)' : 'Select clients…'} />}
					{mode === 'set' && <p className="mt-1 text-xs text-zinc-500">Their current clients are replaced with exactly these.</p>}
				</div>
				<ErrorNote error={error} />
				<div className="flex justify-end gap-2">
					<Button type="button" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" loading={busy} disabled={nothing || ((mode === 'add' || mode === 'remove') && !clientIds.length)}>
						Apply to {ids.length}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
