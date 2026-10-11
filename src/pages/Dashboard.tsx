import { useEffect, useState } from 'react';
import { BookOpen, Building2, History, Users } from 'lucide-react';
import { api, type Overview } from '../api';
import { timeAgo } from '../format';
import { useUser } from '../session';
import { Badge, Card, Empty, PageHeader, Spinner } from '../components/ui';

export function Dashboard() {
	const user = useUser();
	const [data, setData] = useState<Overview | null>(null);
	useEffect(() => {
		api.get<Overview>('/overview').then(setData).catch(() => {});
	}, []);
	if (!data) return <Spinner />;

	const stats = [
		{ label: 'KBs', value: data.counts.articles, icon: <BookOpen className="size-5" />, href: '#/articles' },
		{ label: 'Clients', value: data.counts.clients, icon: <Building2 className="size-5" />, href: '#/clients' },
		{ label: 'User accounts', value: data.counts.users, icon: <Users className="size-5" />, href: user.role === 'admin' ? '#/team' : undefined },
		{ label: 'Updated in last 30 days', value: data.counts.updated_30d, icon: <History className="size-5" />, href: '#/articles' },
	];

	return (
		<>
			<PageHeader title="Dashboard" />
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{stats.map((s) => {
					const inner = (
						<Card className="h-full p-5 transition hover:border-brand-300 dark:hover:border-brand-500/50">
							<div className="flex items-center justify-between gap-2 text-zinc-500">
								<span className="text-sm">{s.label}</span>
								<span className="text-brand-500">{s.icon}</span>
							</div>
							<div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{s.value}</div>
						</Card>
					);
					return s.href ? (
						<a key={s.label} href={s.href}>
							{inner}
						</a>
					) : (
						<div key={s.label}>{inner}</div>
					);
				})}
			</div>

			<h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-500">Recently updated</h2>
			{data.recent.length === 0 ? (
				<Empty icon={<BookOpen className="size-5" />} title="No KBs yet">
					Write your first how-to, fix or runbook and it will show up here.
				</Empty>
			) : (
				<Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
					{data.recent.map((a) => (
						<a key={a.id} href={`#/articles/${a.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
							<div className="min-w-0 flex-1">
								<div className="truncate font-medium">{a.title}</div>
								<div className="mt-0.5 truncate text-xs text-zinc-500">
									{a.updated_by_name ?? 'Someone'} · {timeAgo(a.updated_at)}
									{a.clients.length > 0 && ` · ${a.clients.map((c) => c.name).join(', ')}`}
								</div>
							</div>
							<Badge>{a.category}</Badge>
						</a>
					))}
				</Card>
			)}
		</>
	);
}
