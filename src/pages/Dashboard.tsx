import { useEffect, useState } from 'react';
import { BookOpen, Building2, Users } from 'lucide-react';
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
		{ label: 'Articles', value: data.counts.articles, icon: <BookOpen className="size-5" />, href: '#/articles' },
		{ label: 'Clients', value: data.counts.clients, icon: <Building2 className="size-5" />, href: '#/clients' },
		{ label: 'User accounts', value: data.counts.users, icon: <Users className="size-5" />, href: user.role === 'admin' ? '#/team' : undefined },
	];
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

	return (
		<>
			<PageHeader title={user.guest ? greeting : `${greeting}, ${user.name.split(' ')[0]}`} />
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{stats.map((s) => {
					const inner = (
						<Card className="p-5 transition hover:border-brand-300 dark:hover:border-brand-500/50">
							<div className="flex items-center justify-between text-zinc-500">
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

			<div className="mt-8 grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<h2 className="mb-3 text-sm font-semibold text-zinc-500">Recently updated</h2>
					{data.recent.length === 0 ? (
						<Empty icon={<BookOpen className="size-5" />} title="No articles yet">
							Write your first how-to, fix or runbook and it will show up here.
						</Empty>
					) : (
						<Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
							{data.recent.map((a) => (
								<a key={a.id} href={`#/articles/${a.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium">{a.title}</div>
										<div className="mt-0.5 text-xs text-zinc-500">
											{a.updated_by_name ?? 'Someone'} · {timeAgo(a.updated_at)}
										</div>
									</div>
									{a.client_name && <Badge tone="brand">{a.client_name}</Badge>}
									<Badge>{a.category}</Badge>
								</a>
							))}
						</Card>
					)}
				</div>
				<div>
					<h2 className="mb-3 text-sm font-semibold text-zinc-500">Categories</h2>
					<Card className="p-2">
						{data.categories.length === 0 && <p className="p-3 text-sm text-zinc-500">Categories appear as you add articles.</p>}
						{data.categories.map((c) => (
							<a
								key={c.category}
								href={`#/articles?category=${encodeURIComponent(c.category)}`}
								className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
							>
								{c.category}
								<span className="tabular-nums text-zinc-500">{c.count}</span>
							</a>
						))}
					</Card>
				</div>
			</div>
		</>
	);
}
