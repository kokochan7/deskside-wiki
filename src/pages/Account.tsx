import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useUser } from '../session';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, useFeedback } from '../components/ui';

export function Account() {
	const user = useUser();
	const { toast } = useFeedback();
	const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (f.newPassword !== f.confirm) {
			setError("The new passwords don't match.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await api.put('/me/password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
			setF({ currentPassword: '', newPassword: '', confirm: '' });
			toast('Password changed. Other devices were signed out.');
		} catch (err) {
			setError((err as Error).message);
		}
		setBusy(false);
	};

	return (
		<div className="max-w-xl">
			<PageHeader title="Your account" />
			<Card className="mb-6 p-5">
				<div className="font-medium">{user.name}</div>
				<div className="text-sm text-zinc-500">{user.email}</div>
				<div className="mt-2">
					<Badge tone="brand">
						<span className="capitalize">{user.role}</span>
					</Badge>
				</div>
			</Card>
			<Card className="p-5">
				<h2 className="mb-4 font-semibold">Change password</h2>
				<form onSubmit={submit} className="space-y-4">
					<Field label="Current password">
						<Input type="password" autoComplete="current-password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
					</Field>
					<Field label="New password" hint="At least 10 characters.">
						<Input type="password" autoComplete="new-password" required minLength={10} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
					</Field>
					<Field label="Confirm new password">
						<Input type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
					</Field>
					<ErrorNote error={error} />
					<Button variant="primary" loading={busy}>
						Update password
					</Button>
				</form>
			</Card>
		</div>
	);
}
