import { useEffect, useMemo, useState } from 'react';
import { Building2, Layers } from 'lucide-react';
import { api, imageUrl, type Client, type Overview } from '../api';
import { ClientLogo } from '../branding';
import { Input, cx } from './ui';

// The last filters used on the KB list, so a KB page can link back to them and show which client is picked.
const LAST_LIST = 'kb-list-query';
export const rememberListQuery = (params: URLSearchParams) => {
	try {
		sessionStorage.setItem(LAST_LIST, params.toString());
	} catch {
		/* storage unavailable */
	}
};
export const lastListQuery = () => {
	try {
		return new URLSearchParams(sessionStorage.getItem(LAST_LIST) ?? '');
	} catch {
		return new URLSearchParams();
	}
};

// The Clients list beside the knowledge base: All KBs, Internal, then every client with its KB count.
export function ClientSidebar({ active, onSelect, reload = 0 }: { active: string; onSelect: (client: string) => void; reload?: number }) {
	const [clients, setClients] = useState<Client[]>([]);
	const [counts, setCounts] = useState({ articles: 0, internal: 0 });
	const [filter, setFilter] = useState('');

	useEffect(() => {
		api.get<Client[]>('/clients').then(setClients).catch(() => {});
		api.get<Overview>('/overview').then((o) => setCounts(o.counts)).catch(() => {});
	}, [reload]);

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
			<nav className="flex max-h-56 flex-col gap-0.5 overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
				{item('', 'All KBs', counts.articles, <Layers className="size-6 shrink-0 p-1 text-zinc-400" />)}
				{item('none', 'Internal', counts.internal, <Building2 className="size-6 shrink-0 p-1 text-zinc-400" />)}
				{shown.length > 0 && <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-800" />}
				{shown.map((c) => item(String(c.id), c.name, c.article_count ?? 0, <ClientLogo name={c.name} logoUrl={imageUrl(c.logo_image_id)} size="sm" />))}
			</nav>
		</>
	);
}
