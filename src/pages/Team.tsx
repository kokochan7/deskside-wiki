import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { api, type Role, type TeamMember } from '../api';
import { initials, timeAgo } from '../format';
import { useUser } from '../session';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, useFeedback } from '../components/ui';

const ROLE_INFO: Record<Role, string> = {
	admin: 'Full access, including managing the team.',
	technician: 'Can create, edit and delete articles, clients and contacts.',
	viewer: 'Read-only access.',
};

export function Team() {
	const me = useUser();
	const { confirm, toast } = useFeedback();
	const [users, setUsers] = useState<TeamMember[] | null>(null);
	const [editing, setEditing] = useState<TeamMember | 'new' | null>(null);

	const load = useCallback(() => api.get<TeamMember[]>('/users').then(setUsers).catch(() => setUsers([])), []);
	useEffect(() => {
		load();
	}, [load]);

	const remove = async (u: TeamMember) => {
		if (!(await confirm('Remove team member?', `${u.name} will lose access immediately. Articles they wrote are kept.`, 'Remove'))) return;
		try {
			await api.del(`/users/${u.id}`);
			toast(`${u.name} removed`);
			load();
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};

	return (
		<>
			<PageHeader
				title="Team"
				subtitle="Who can sign in, and what they can do."
				actions={
					<Button variant="primary" onClick={() => setEditing('new')}>
						<UserPlus className="size-4" /> Add member
					</Button>
				}
			/>
			{!users ? (
				<Spinner />
			) : (
				<Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
					{users.map((u) => (
						<div key={u.id} className="flex items-center gap-3 px-5 py-4">
							<span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-semibold text-white">
								{initials(u.name)}
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2 font-medium">
									{u.name}
									{u.id === me.id && <span className="text-xs font-normal text-zinc-400">(you)</span>}
									{!u.active && <Badge tone="amber">Disabled</Badge>}
								</div>
								<div className="truncate text-sm text-zinc-500">{u.email}</div>
							</div>
							<span className="hidden text-xs text-zinc-400 md:inline">Last sign-in {timeAgo(u.last_login_at)}</span>
							<Badge tone={u.role === 'admin' ? 'brand' : u.role === 'technician' ? 'green' : 'zinc'}>
								<span className="capitalize">{u.role}</span>
							</Badge>
							<Button size="sm" variant="ghost" onClick={() => setEditing(u)} title="Edit">
								<Pencil className="size-4" />
							</Button>
							{u.id !== me.id && (
								<Button size="sm" variant="ghost" onClick={() => remove(u)} title="Remove" className="hover:text-red-600">
									<Trash2 className="size-4" />
								</Button>
							)}
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
	const [f, setF] = useState({ name: '', email: '', role: 'technician' as Role, password: '', active: true });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (!user) return;
		setF(user === 'new' ? { name: '', email: '', role: 'technician', password: '', active: true } : { name: user.name, email: user.email, role: user.role, password: '', active: !!user.active });
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
			toast(isNew ? `${f.name} added` : 'Changes saved');
			onClose();
			onSaved();
		} catch (err) {
			setError((err as Error).message);
			setBusy(false);
		}
	};

	return (
		<Modal open={!!user} onClose={onClose} title={isNew ? 'Add team member' : 'Edit team member'}>
			<form onSubmit={submit} className="space-y-4">
				<Field label="Name">
					<Input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
				</Field>
				<Field label="Email">
					<Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
				</Field>
				<Field label="Role" hint={ROLE_INFO[f.role]}>
					<Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
						<option value="technician">Technician</option>
						<option value="admin">Admin</option>
						<option value="viewer">Viewer</option>
					</Select>
				</Field>
				<Field label={isNew ? 'Temporary password' : 'Reset password'} hint={isNew ? 'At least 10 characters. Share it with them privately.' : 'Leave blank to keep their current password.'}>
					<Input type="text" autoComplete="new-password" required={isNew} minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
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
						{isNew ? 'Add member' : 'Save'}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
