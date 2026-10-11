import { useEffect, useState } from 'react';
import { BookOpen, FilePlus2, Search } from 'lucide-react';
import { api, type ArticleSummary, type Client } from '../api';
import { timeAgo } from '../format';
import { navigate, query } from '../router';
import { canEdit, useUser } from '../session';
import { Badge, Button, Card, Empty, Input, PageHeader, Select, Spinner, safeSnippet } from '../components/ui';

export function ArticleList() {
	const user = useUser();
	const [q, setQ] = useState(() => query().get('q') ?? '');
	const [category, setCategory] = useState(() => query().get('category') ?? '');
	const [client, setClient] = useState(() => query().get('client') ?? '');
	const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
	const [categories, setCategories] = useState<string[]>([]);
	const [clients, setClients] = useState<Client[]>([]);

	useEffect(() => {
		api.get<string[]>('/categories').then(setCategories).catch(() => {});
		api.get<Client[]>('/clients').then(setClients).catch(() => {});
	}, []);

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
	}, [q, category, client]);

	return (
		<>
			<PageHeader
				title="Knowledge base"
				subtitle="How-tos, fixes and runbooks for the team."
				actions={
					canEdit(user) && (
						<Button variant="primary" onClick={() => navigate('/articles/new')}>
							<FilePlus2 className="size-4" /> New article
						</Button>
					)
				}
			/>
			<div className="mb-5 flex flex-col gap-3 sm:flex-row">
				<div className="relative flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, content and tags…" className="pl-9" autoFocus />
				</div>
				<Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48" aria-label="Category">
					<option value="">All categories</option>
					{categories.map((c) => (
						<option key={c}>{c}</option>
					))}
				</Select>
				<Select value={client} onChange={(e) => setClient(e.target.value)} className="sm:w-48" aria-label="Client">
					<option value="">All clients</option>
					<option value="none">Internal (no client)</option>
					{clients.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</Select>
			</div>

			{!articles ? (
				<Spinner />
			) : articles.length === 0 ? (
				<Empty icon={<BookOpen className="size-5" />} title={q || category || client ? 'No matching articles' : 'No articles yet'}>
					{q || category || client ? 'Try a different search or clear the filters.' : 'Create the first article to start building your knowledge base.'}
				</Empty>
			) : (
				<Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
					{articles.map((a) => (
						<a key={a.id} href={`#/articles/${a.id}`} className="block px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium">{a.title}</span>
								<Badge>{a.category}</Badge>
								{a.client_name && <Badge tone="brand">{a.client_name}</Badge>}
							</div>
							{a.snippet && (
								<p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400" dangerouslySetInnerHTML={{ __html: safeSnippet(q ? a.snippet : stripMd(a.snippet)) }} />
							)}
							<div className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-400">
								<span>
									Updated {timeAgo(a.updated_at)}
									{a.updated_by_name && ` by ${a.updated_by_name}`}
								</span>
								{a.tags && <span>{a.tags.split(',').map((t) => '#' + t.trim()).join(' ')}</span>}
							</div>
						</a>
					))}
				</Card>
			)}
		</>
	);
}

const stripMd = (s: string) => s.replace(/[#>*_`~\[\]()!|-]+/g, ' ').replace(/\s+/g, ' ').trim();
