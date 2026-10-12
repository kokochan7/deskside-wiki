import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Building2, Layers } from 'lucide-react';
import { api, imageUrl, type Client, type Overview } from '../api';
import { ClientLogo } from '../branding';
import { navigate } from '../router';
import { Input, cx } from './ui';

// The last filters used on the KB list, so a KB page can link back to them and show which client is picked.
const LAST_LIST = 'kb-list-query';
const LIST_CHANGED = 'kb-list-changed';
export const rememberListQuery = (params: URLSearchParams) => {
	try {
		sessionStorage.setItem(LAST_LIST, params.toString());
	} catch {
		/* storage unavailable */
	}
	window.dispatchEvent(new Event(LIST_CHANGED));
};
export const lastListQuery = () => {
	try {
		return new URLSearchParams(sessionStorage.getItem(LAST_LIST) ?? '');
	} catch {
		return new URLSearchParams();
	}
};

// Ask the sidebar to fetch its counts again (after KBs are deleted or moved).
const REFRESH = 'kb-sidebar-refresh';
export const refreshClientSidebar = () => window.dispatchEvent(new Event(REFRESH));

// Kept between visits so the list shows straight away instead of popping in.
let cache: { clients: Client[]; counts: { articles: number; internal: number } } | null = null;

// The knowledge base pages (the list and a single KB) share this layout, so the Clients list on the left stays put
// while moving between them instead of being rebuilt each time.
export function KnowledgeBaseLayout({ children, onKbPage }: { children: ReactNode; onKbPage: boolean }) {
	const [active, setActive] = useState(() => lastListQuery().get('client') ?? '');
	useEffect(() => {
		const sync = () => setActive(lastListQuery().get('client') ?? '');
		window.addEventListener(LIST_CHANGED, sync);
		return () => window.removeEventListener(LIST_CHANGED, sync);
	}, []);
	const select = (client: string) => {
		// From a KB, start a fresh list for that client (keeping the sort); on the list, keep the other filters.
		const params = onKbPage ? new URLSearchParams() : lastListQuery();
		const sort = lastListQuery().get('sort');
		if (onKbPage && sort) params.set('sort', sort);
		if (client) params.set('client', client);
		else params.delete('client');
		navigate(`/articles${params.size ? '?' + params : ''}`);
	};
	return (
		<div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
			<aside className={cx('lg:self-start', onKbPage && 'hidden lg:block')}>
				<ClientSidebar active={active} onSelect={select} />
			</aside>
			<div className="min-w-0">{children}</div>
		</div>
	);
}

// The Clients list beside the knowledge base: All KBs, Internal, then every client with its KB count.
function ClientSidebar({ active, onSelect }: { active: string; onSelect: (client: string) => void }) {
	const [clients, setClients] = useState<Client[]>(cache?.clients ?? []);
	const [counts, setCounts] = useState(cache?.counts ?? { articles: 0, internal: 0 });
	const [filter, setFilter] = useState('');

	useEffect(() => {
		const load = () =>
			Promise.all([api.get<Client[]>('/clients'), api.get<Overview>('/overview')])
				.then(([c, o]) => {
					cache = { clients: c, counts: o.counts };
					setClients(c);
					setCounts(o.counts);
				})
				.catch(() => {});
		load();
		window.addEventListener(REFRESH, load);
		return () => window.removeEventListener(REFRESH, load);
	}, []);

	const shown = useMemo(() => clients.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase())), [clients, filter]);

	const item = (key: string, label: string, count: number, icon: React.ReactNode) => (
		<button
			key={key}
			onClick={() => onSelect(key)}
			className={cx(
				'flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition lg:w-full',
				active === key
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
			<div className="mb-2 flex items-center justify-between px-1">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Clients</h2>
			</div>
			{clients.length > 8 && <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a client…" className="mb-2 h-8! text-xs" />}
			{/* Phones get a short scrolling list above the KBs; on wider screens every client shows. */}
			<nav className="flex max-h-56 flex-col gap-0.5 overflow-y-auto lg:max-h-none lg:overflow-visible">
				{item('', 'All KBs', counts.articles, <Layers className="size-6 shrink-0 p-1 text-zinc-400" />)}
				{item('none', 'Internal', counts.internal, <Building2 className="size-6 shrink-0 p-1 text-zinc-400" />)}
				{shown.length > 0 && <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-800" />}
				{shown.map((c) => item(String(c.id), c.name, c.article_count ?? 0, <ClientLogo name={c.name} logoUrl={imageUrl(c.logo_image_id)} size="sm" />))}
			</nav>
		</>
	);
}
