import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Building2, History, Users } from 'lucide-react';
import { api, type Overview } from '../api';
import { timeAgo } from '../format';
import { useUser } from '../session';
import { Badge, Card, Empty, PageHeader, Spinner, cx } from '../components/ui';

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
		{ label: 'Updated in last 30 days', value: data.counts.updated_30d, icon: <History className="size-5" />, href: '#/articles' },
	];
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	const weeks = lastWeeks(12, data.weekly);

	return (
		<>
			<PageHeader title={user.guest ? greeting : `${greeting}, ${user.name.split(' ')[0]}`} />
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

			<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
				<Panel title="New articles per week" className="lg:col-span-2" aside={`${weeks.reduce((n, w) => n + w.count, 0)} in the last 12 weeks`}>
					<WeeklyColumns weeks={weeks} />
				</Panel>
				<Panel title="Articles by category">
					{data.categories.length === 0 ? (
						<p className="text-sm text-zinc-500">Categories appear as you add articles.</p>
					) : (
						<Bars rows={data.categories.slice(0, 8).map((c) => ({ key: c.category, label: c.category, value: c.count, href: `#/articles?category=${encodeURIComponent(c.category)}` }))} />
					)}
				</Panel>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<h2 className="mb-3 text-sm font-semibold text-zinc-500">Recently updated</h2>
					{data.recent.length === 0 ? (
						<Empty icon={<BookOpen className="size-5" />} title="No articles yet">
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
				</div>
				<Panel title="Top clients by articles">
					{data.clients.length === 0 ? (
						<p className="text-sm text-zinc-500">Link articles to clients to see them here.</p>
					) : (
						<Bars
							rows={[
								...data.clients.map((c) => ({ key: String(c.id), label: c.name, value: c.count, href: `#/articles?client=${c.id}` })),
								...(data.counts.internal ? [{ key: 'none', label: 'Internal', value: data.counts.internal, href: '#/articles?client=none', muted: true }] : []),
							]}
						/>
					)}
				</Panel>
			</div>
		</>
	);
}

function Panel({ title, aside, className, children }: { title: string; aside?: string; className?: string; children: ReactNode }) {
	return (
		<div className={className}>
			<div className="mb-3 flex items-baseline justify-between gap-2">
				<h2 className="text-sm font-semibold text-zinc-500">{title}</h2>
				{aside && <span className="text-xs text-zinc-400">{aside}</span>}
			</div>
			<Card className="h-[calc(100%-2rem)] p-5">{children}</Card>
		</div>
	);
}

type Week = { week: string; count: number };

// The Mondays of the last n weeks (UTC, matching the server), oldest first, with zero for empty weeks.
function lastWeeks(n: number, data: Week[]): Week[] {
	const byWeek = new Map(data.map((w) => [w.week, w.count]));
	const now = new Date();
	const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - ((now.getUTCDay() + 6) % 7) * 864e5;
	return Array.from({ length: n }, (_, i) => {
		const week = new Date(monday - (n - 1 - i) * 7 * 864e5).toISOString().slice(0, 10);
		return { week, count: byWeek.get(week) ?? 0 };
	});
}

const shortDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

function WeeklyColumns({ weeks }: { weeks: Week[] }) {
	const [hover, setHover] = useState<number | null>(null);
	const max = Math.max(1, ...weeks.map((w) => w.count));
	const ticks = niceTicks(max);
	const top = ticks[ticks.length - 1];
	return (
		<div className="flex gap-3">
			<div className="flex h-72 flex-col-reverse justify-between pb-6 text-right text-[11px] tabular-nums text-zinc-400">
				{ticks.map((t) => (
					<span key={t} className="-translate-y-1/2 leading-none first:translate-y-0">
						{t}
					</span>
				))}
			</div>
			<div className="relative flex-1">
				<div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col-reverse justify-between">
					{ticks.map((t, i) => (
						<div key={t} className={cx('border-t', i === 0 ? 'border-zinc-300 dark:border-zinc-700' : 'border-dashed border-zinc-100 dark:border-zinc-800')} />
					))}
				</div>
				<div className="relative flex h-72 items-stretch gap-[2px]" onMouseLeave={() => setHover(null)}>
					{weeks.map((w, i) => (
						<div
							key={w.week}
							className="group relative flex flex-1 flex-col justify-end pb-6"
							onMouseEnter={() => setHover(i)}
							onFocus={() => setHover(i)}
							tabIndex={0}
							aria-label={`Week of ${shortDate(w.week)}: ${w.count} new article${w.count === 1 ? '' : 's'}`}
						>
							{hover === i && <div className="absolute inset-x-0 top-0 bottom-6 rounded-md bg-zinc-100/70 dark:bg-zinc-800/50" />}
							<div
								className="relative mx-auto w-full max-w-7 rounded-t-[4px] bg-brand-500 dark:bg-brand-400"
								style={{ height: `${(w.count / top) * 100}%`, minHeight: w.count ? 2 : 0 }}
							/>
							{(i % 3 === 2 || i === weeks.length - 1) && (
								<span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-zinc-400">{shortDate(w.week)}</span>
							)}
							{hover === i && (
								<div
									className={cx(
										'pointer-events-none absolute top-2 z-10 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900',
										i < weeks.length / 2 ? 'left-full ml-1' : 'right-full mr-1',
									)}
								>
									<div className="text-zinc-500">Week of {shortDate(w.week)}</div>
									<div className="font-semibold tabular-nums">
										{w.count} new article{w.count === 1 ? '' : 's'}
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// 3–5 evenly spaced whole-number ticks from 0 that cover max.
function niceTicks(max: number): number[] {
	const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((s) => max / s <= 4) ?? Math.ceil(max / 4);
	const ticks = [];
	for (let t = 0; t < max + step; t += step) ticks.push(t);
	return ticks;
}

type BarRow = { key: string; label: string; value: number; href: string; muted?: boolean };

function Bars({ rows }: { rows: BarRow[] }) {
	const max = Math.max(1, ...rows.map((r) => r.value));
	return (
		<div className="space-y-2.5">
			{rows.map((r) => (
				<a key={r.key} href={r.href} className="group block" title={`${r.label}: ${r.value} article${r.value === 1 ? '' : 's'}`}>
					<div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
						<span className="truncate text-zinc-700 group-hover:text-brand-700 dark:text-zinc-300 dark:group-hover:text-brand-300">{r.label}</span>
						<span className="tabular-nums text-xs text-zinc-500">{r.value}</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
						<div
							className={cx('h-full rounded-full transition-[filter] group-hover:brightness-110', r.muted ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-brand-500 dark:bg-brand-400')}
							style={{ width: `${(r.value / max) * 100}%` }}
						/>
					</div>
				</a>
			))}
		</div>
	);
}
