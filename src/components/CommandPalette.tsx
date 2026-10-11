import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Building2, FilePlus2, Search } from 'lucide-react';
import { api, type ArticleSummary, type Client } from '../api';
import { navigate } from '../router';
import { canEdit, useUser } from '../session';
import { cx, safeSnippet } from './ui';

type Item = { key: string; icon: React.ReactNode; title: string; sub?: string; html?: string; go: () => void };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
	const user = useUser();
	const [q, setQ] = useState('');
	const [articles, setArticles] = useState<ArticleSummary[]>([]);
	const [clients, setClients] = useState<Client[]>([]);
	const [active, setActive] = useState(0);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) return;
		setQ('');
		setActive(0);
		api.get<Client[]>('/clients').then(setClients).catch(() => {});
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const t = setTimeout(() => {
			api.get<ArticleSummary[]>(`/articles?q=${encodeURIComponent(q)}`)
				.then((r) => setArticles(r.slice(0, 8)))
				.catch(() => {});
		}, 120);
		return () => clearTimeout(t);
	}, [q, open]);

	const items = useMemo<Item[]>(() => {
		const go = (path: string) => () => {
			onClose();
			navigate(path);
		};
		const list: Item[] = articles.map((a) => ({
			key: 'a' + a.id,
			icon: <BookOpen className="size-4" />,
			title: a.title,
			sub: [a.category, a.client_name].filter(Boolean).join(' · '),
			html: q ? safeSnippet(a.snippet) : undefined,
			go: go(`/articles/${a.id}`),
		}));
		const needle = q.toLowerCase();
		clients
			.filter((c) => !needle || c.name.toLowerCase().includes(needle))
			.slice(0, 5)
			.forEach((c) => list.push({ key: 'c' + c.id, icon: <Building2 className="size-4" />, title: c.name, sub: 'Client', go: go(`/clients/${c.id}`) }));
		if (canEdit(user))
			list.push({ key: 'new', icon: <FilePlus2 className="size-4" />, title: 'Create New KB', sub: 'Create', go: go('/articles/new') });
		return list;
	}, [articles, clients, q, user, onClose]);

	useEffect(() => setActive(0), [items.length]);

	if (!open) return null;

	const onKey = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') onClose();
		else if (e.key === 'ArrowDown') {
			e.preventDefault();
			setActive((i) => Math.min(i + 1, items.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActive((i) => Math.max(i - 1, 0));
		} else if (e.key === 'Enter') items[active]?.go();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
			<div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} />
			<div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" onKeyDown={onKey}>
				<div className="flex items-center gap-3 border-b border-zinc-100 px-4 dark:border-zinc-800">
					<Search className="size-5 text-zinc-400" />
					<input
						ref={input}
						autoFocus
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search articles and clients…"
						className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400"
					/>
					<kbd className="rounded border border-zinc-200 px-1.5 text-[11px] text-zinc-500 dark:border-zinc-700">esc</kbd>
				</div>
				<ul className="max-h-[60vh] overflow-y-auto p-2">
					{items.length === 0 && <li className="px-3 py-8 text-center text-sm text-zinc-500">No results for “{q}”</li>}
					{items.map((it, i) => (
						<li key={it.key}>
							<button
								onMouseEnter={() => setActive(i)}
								onClick={it.go}
								className={cx('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left', i === active && 'bg-brand-50 dark:bg-brand-500/15')}
							>
								<span className={cx('mt-0.5', i === active ? 'text-brand-600 dark:text-brand-300' : 'text-zinc-400')}>{it.icon}</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium">{it.title}</span>
									{it.html ? (
										<span className="line-clamp-1 text-xs text-zinc-500" dangerouslySetInnerHTML={{ __html: it.html }} />
									) : (
										it.sub && <span className="block truncate text-xs text-zinc-500">{it.sub}</span>
									)}
								</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
