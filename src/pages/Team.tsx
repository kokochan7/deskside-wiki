import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Search, Trash2, UserPlus } from 'lucide-react';
import { api, type Role, type TeamMember } from '../api';
import { initials, timeAgo } from '../format';
import { useUser } from '../session';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, PasswordInput, Select, Spinner, useFeedback } from '../components/ui';

const ROLE_INFO: Record<Role, string> = {
	admin: 'Full access, including deleting and managing user accounts.',
	technician: 'Can create and edit KBs and clients, but not delete them.',
	viewer: 'Read-only access.',
};

export function Team() {
	const me = useUser();
	const { confirm, toast } = useFeedback();
	const [users, setUsers] = useState<TeamMember[] | null>(null);
	const [editing, setEditing] = useState<TeamMember | 'new' | null>(null);
	const [q, setQ] = useState('');

	const load = useCallback(() => api.get<TeamMember[]>('/users').then(setUsers).catch(() => setUsers([])), []);
	useEffect(() => {
		load();
	}, [load]);

	const remove = async (u: TeamMember) => {
		if (!(await confirm('Remove user account?', `${u.username} will lose access immediately. KBs they wrote are kept.`, 'Remove'))) return;
		try {
			await api.del(`/users/${u.id}`);
			toast(`${u.username} removed`);
			load();
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};

	return (
		<>
			<PageHeader
				title="User Accounts"
				actions={
					<Button variant="primary" onClick={() => setEditing('new')}>
						<UserPlus className="size-4" /> Add user
					</Button>
				}
			/>
			{users && users.length > 1 && (
				<div className="relative mb-5 max-w-md">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter user accounts…" className="pl-9" />
				</div>
			)}
			{!users ? (
				<Spinner />
			) : (
				<Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
					{users
						.filter((u) => u.username.includes(q.trim().toLowerCase()))
						.map((u) => (
							<div key={u.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
								<span className="grid size-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-brand-400 to-brand-700 text-[10px] font-semibold text-white">
									{initials(u.username)}
								</span>
								<button type="button" onClick={() => setEditing(u)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
									<span className="truncate font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{u.username}</span>
									{u.id === me.id && <span className="text-xs text-zinc-400">(you)</span>}
									{!u.active && <Badge tone="amber">Disabled</Badge>}
								</button>
								<span className="hidden w-48 truncate text-xs text-zinc-500 md:inline">Last sign-in {timeAgo(u.last_login_at)}</span>
								<span className="w-24 shrink-0 text-xs capitalize text-zinc-500">{u.role}</span>
								<div className="flex w-16 shrink-0 justify-end">
									<button type="button" onClick={() => setEditing(u)} title="Edit" aria-label={`Edit ${u.username}`} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
										<Pencil className="size-4" />
									</button>
									{u.id !== me.id && (
										<button type="button" onClick={() => remove(u)} title="Remove" aria-label={`Remove ${u.username}`} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800">
											<Trash2 className="size-4" />
										</button>
									)}
								</div>
							</div>
						))}
				</Card>
			)}
			<UserForm user={editing} onClose={() => setEditing(null)} onSaved={load} />
		</>
	);
}

function UserForm({ user, onClose, onSaved }: { user: TeamMember | 'new' | null; onClose: () => void; onSaved: () => void }) {
	const { toast } = useFeedback();
	const isNew = user === 'new';
	const [f, setF] = useState({ username: '', role: 'technician' as Role, password: '', active: true });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (!user) return;
		setF(user === 'new' ? { username: '', role: 'technician', password: '', active: true } : { username: user.username, role: user.role, password: '', active: !!user.active });
		setError(null);
		setBusy(false);
	}, [user]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			if (isNew) await api.post('/users', f);
			else await api.put(`/users/${(user as TeamMember).id}`, { ...f, password: f.password || undefined });
			toast(isNew ? `${f.username} added` : 'Changes saved');
			onClose();
			onSaved();
		} catch (err) {
			setError((err as Error).message);
			setBusy(false);
		}
	};

	return (
		<Modal open={!!user} onClose={onClose} title={isNew ? 'Add user account' : 'Edit user account'}>
			<form onSubmit={submit} className="space-y-4">
				<Field label="Username" hint="Used to sign in. Letters, numbers, dots, dashes and underscores.">
					<Input
						required
						autoFocus
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
						pattern="[A-Za-z0-9._\-]{2,40}"
						value={f.username}
						onChange={(e) => setF({ ...f, username: e.target.value })}
					/>
				</Field>
				<Field label="Role" hint={ROLE_INFO[f.role]}>
					<Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
						<option value="technician">Technician</option>
						<option value="admin">Admin</option>
						<option value="viewer">Viewer</option>
					</Select>
				</Field>
				<Field label={isNew ? 'Temporary password' : 'Reset password'} hint={isNew ? 'Share it with them privately.' : 'Leave blank to keep their current password.'}>
					<PasswordInput autoComplete="new-password" required={isNew} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
				</Field>
				{!isNew && (
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="size-4 accent-brand-600" />
						Account active (uncheck to block sign-in without deleting)
					</label>
				)}
				<ErrorNote error={error} />
				<div className="flex justify-end gap-2">
					<Button type="button" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" loading={busy}>
						{isNew ? 'Add user' : 'Save'}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
