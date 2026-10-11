import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Building2, LayoutDashboard, LogOut, Menu, Moon, Search, Sun, UserCog, Users, X } from 'lucide-react';
import { api, setUnauthorizedHandler, type User } from './api';
import { navigate, useRoute } from './router';
import { cx, FeedbackProvider, Spinner } from './components/ui';
import { CommandPalette } from './components/CommandPalette';
import { initials } from './format';
import { UserCtx, useUser, canEdit } from './session';
import { Login, Setup } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { ArticleList } from './pages/ArticleList';
import { ArticleView } from './pages/ArticleView';
import { ArticleEdit } from './pages/ArticleEdit';
import { ClientList } from './pages/ClientList';
import { ClientView } from './pages/ClientView';
import { Team } from './pages/Team';
import { Account } from './pages/Account';


export default function App() {
	const [state, setState] = useState<'loading' | 'setup' | 'login' | 'in'>('loading');
	const [user, setUser] = useState<User | null>(null);

	const load = useCallback(async () => {
		try {
			setUser(await api.get<User>('/me'));
			setState('in');
		} catch {
			const { needsSetup } = await api.get<{ needsSetup: boolean }>('/setup').catch(() => ({ needsSetup: false }));
			setState(needsSetup ? 'setup' : 'login');
		}
	}, []);

	useEffect(() => {
		setUnauthorizedHandler(() => {
			setUser(null);
			setState('login');
		});
		load();
	}, [load]);

	return (
		<FeedbackProvider>
			{state === 'loading' && <Spinner />}
			{state === 'setup' && <Setup onDone={load} />}
			{state === 'login' && <Login onDone={load} />}
			{state === 'in' && user && (
				<UserCtx.Provider value={user}>
					<Shell
						onLogout={async () => {
							await api.post('/logout').catch(() => {});
							setUser(null);
							setState('login');
						}}
					/>
				</UserCtx.Provider>
			)}
		</FeedbackProvider>
	);
}

function useTheme() {
	const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
	const toggle = () => {
		const next = !dark;
		document.documentElement.classList.toggle('dark', next);
		try {
			localStorage.setItem('theme', next ? 'dark' : 'light');
		} catch {}
		setDark(next);
	};
	return { dark, toggle };
}

function Shell({ onLogout }: { onLogout: () => void }) {
	const user = useUser();
	const route = useRoute();
	const { dark, toggle } = useTheme();
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [navOpen, setNavOpen] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				setPaletteOpen((o) => !o);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);
	useEffect(() => setNavOpen(false), [route.join('/')]);

	const section = route[0] ?? '';
	const nav: { href: string; label: string; icon: ReactNode; key: string; show?: boolean }[] = [
		{ href: '#/', label: 'Dashboard', icon: <LayoutDashboard className="size-4" />, key: '' },
		{ href: '#/articles', label: 'Knowledge base', icon: <BookOpen className="size-4" />, key: 'articles' },
		{ href: '#/clients', label: 'Clients', icon: <Building2 className="size-4" />, key: 'clients' },
		{ href: '#/team', label: 'Team', icon: <Users className="size-4" />, key: 'team', show: user.role === 'admin' },
	];

	const sidebar = (
		<div className="flex h-full flex-col">
			<a href="#/" className="flex items-center gap-2.5 px-5 py-5">
				<img src="/favicon.svg" alt="" className="size-8" />
				<span className="font-semibold tracking-tight">Deskside KB</span>
			</a>
			<div className="px-3">
				<button
					onClick={() => setPaletteOpen(true)}
					className="mb-4 flex h-9 w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-500 shadow-xs hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
				>
					<Search className="size-4" />
					Search…
					<kbd className="ml-auto rounded border border-zinc-200 px-1.5 font-sans text-[11px] dark:border-zinc-700">⌘K</kbd>
				</button>
			</div>
			<nav className="flex-1 space-y-0.5 px-3">
				{nav
					.filter((n) => n.show !== false)
					.map((n) => (
						<a
							key={n.key}
							href={n.href}
							className={cx(
								'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
								section === n.key
									? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
									: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
							)}
						>
							{n.icon}
							{n.label}
						</a>
					))}
			</nav>
			<div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
				<div className="flex items-center gap-1">
					<a href="#/account" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60" title="Your account">
						<span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-semibold text-white">
							{initials(user.name)}
						</span>
						<span className="min-w-0">
							<span className="block truncate text-sm font-medium">{user.name}</span>
							<span className="block truncate text-xs capitalize text-zinc-500">{user.role}</span>
						</span>
					</a>
					<button onClick={toggle} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Toggle theme" aria-label="Toggle theme">
						{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
					</button>
					<button onClick={onLogout} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Sign out" aria-label="Sign out">
						<LogOut className="size-4" />
					</button>
				</div>
			</div>
		</div>
	);

	return (
		<div className="min-h-screen">
			<aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-zinc-50/80 backdrop-blur lg:block dark:border-zinc-800 dark:bg-zinc-950/80">
				{sidebar}
			</aside>
			{navOpen && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div className="absolute inset-0 bg-zinc-950/40" onClick={() => setNavOpen(false)} />
					<aside className="absolute inset-y-0 left-0 w-72 bg-zinc-50 shadow-xl dark:bg-zinc-950">{sidebar}</aside>
				</div>
			)}
			<header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/80">
				<button onClick={() => setNavOpen(true)} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Open menu">
					{navOpen ? <X className="size-5" /> : <Menu className="size-5" />}
				</button>
				<span className="font-semibold">Deskside KB</span>
				<button onClick={() => setPaletteOpen(true)} className="ml-auto rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Search">
					<Search className="size-5" />
				</button>
			</header>
			<main className="lg:pl-64">
				<div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
					<Page route={route} />
				</div>
			</main>
			<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
		</div>
	);
}

function Page({ route }: { route: string[] }) {
	const user = useUser();
	const [a, b, c] = route;
	if (!a) return <Dashboard />;
	if (a === 'articles') {
		if (!b) return <ArticleList />;
		if (b === 'new') return canEdit(user) ? <ArticleEdit /> : <NotFound />;
		if (c === 'edit') return canEdit(user) ? <ArticleEdit id={Number(b)} key={b} /> : <NotFound />;
		return <ArticleView id={Number(b)} key={b} />;
	}
	if (a === 'clients') return b ? <ClientView id={Number(b)} key={b} /> : <ClientList />;
	if (a === 'team' && user.role === 'admin') return <Team />;
	if (a === 'account') return <Account />;
	return <NotFound />;
}

function NotFound() {
	return (
		<div className="py-24 text-center">
			<UserCog className="mx-auto mb-3 size-8 text-zinc-400" />
			<h1 className="text-lg font-semibold">Page not found</h1>
			<p className="mt-1 text-sm text-zinc-500">It may have been deleted, or you may not have access.</p>
			<button className="mt-4 text-sm font-medium text-brand-600" onClick={() => navigate('/')}>
				Back to dashboard
			</button>
		</div>
	);
}
