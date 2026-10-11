import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api';
import { Button, ErrorNote, Field, Input } from '../components/ui';
import { BrandMark, useBranding } from '../branding';

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
	return (
		<div className="relative grid min-h-screen place-items-center overflow-hidden px-4">
			<div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-400/30 via-fuchsia-400/20 to-sky-400/30 blur-3xl dark:from-brand-600/25 dark:via-fuchsia-600/10 dark:to-sky-600/20" />
			<div className="relative w-full max-w-sm">
				<div className="mb-8 text-center">
					<BrandMark className="mx-auto mb-4 size-12 rounded-xl" />
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
				</div>
				<div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">{children}</div>
			</div>
		</div>
	);
}

function useSubmit(fn: () => Promise<unknown>) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError((err as Error).message);
			setBusy(false);
		}
	};
	return { busy, error, submit };
}

export function Login({ onDone, onBrowse }: { onDone: () => void; onBrowse?: () => void }) {
	const { settings } = useBranding();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const { busy, error, submit } = useSubmit(async () => {
		await api.post('/login', { email, password });
		onDone();
	});
	return (
		<AuthCard title="Welcome back" subtitle={`Sign in to ${settings.site_name}`}>
			<form onSubmit={submit} className="space-y-4">
				<Field label="Email">
					<Input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
				</Field>
				<Field label="Password">
					<Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
				</Field>
				<ErrorNote error={error} />
				<Button variant="primary" className="w-full" loading={busy}>
					Sign in
				</Button>
				<p className="text-center text-xs text-zinc-500">Forgot your password? Ask an admin to reset it.</p>
				{onBrowse && (
					<button type="button" onClick={onBrowse} className="block w-full text-center text-sm font-medium text-brand-600 hover:underline">
						Continue without signing in
					</button>
				)}
			</form>
		</AuthCard>
	);
}

export function Setup({ onDone }: { onDone: () => void }) {
	const [f, setF] = useState({ name: '', email: '', password: '' });
	const { busy, error, submit } = useSubmit(async () => {
		await api.post('/setup', f);
		onDone();
	});
	return (
		<AuthCard title="Set up your knowledge base" subtitle="Create the first admin account. You can invite your team next.">
			<form onSubmit={submit} className="space-y-4">
				<Field label="Your name">
					<Input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
				</Field>
				<Field label="Email">
					<Input type="email" autoComplete="username" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
				</Field>
				<Field label="Password" hint="At least 10 characters.">
					<Input type="password" autoComplete="new-password" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
				</Field>
				<ErrorNote error={error} />
				<Button variant="primary" className="w-full" loading={busy}>
					Create admin account
				</Button>
			</form>
		</AuthCard>
	);
}
