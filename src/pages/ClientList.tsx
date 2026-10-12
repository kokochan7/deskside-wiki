import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { api, imageUrl, type Client } from '../api';
import { ClientLogo, LogoPicker } from '../branding';
import { navigate } from '../router';
import { canEdit, useUser } from '../session';
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, PageHeader, Spinner, useFeedback } from '../components/ui';

export function ClientList() {
	const user = useUser();
	const [clients, setClients] = useState<Client[] | null>(null);
	const [q, setQ] = useState('');
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		api.get<Client[]>('/clients').then(setClients).catch(() => setClients([]));
	}, []);

	const shown = clients?.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

	return (
		<>
			<PageHeader
				title="Clients"
				actions={
					canEdit(user) && (
						<Button variant="primary" onClick={() => setAdding(true)}>
							<Plus className="size-4" /> Add client
						</Button>
					)
				}
			/>
			{clients && clients.length > 0 && (
				<div className="relative mb-5 max-w-md">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter clients…" className="pl-9" />
				</div>
			)}
			{!shown ? (
				<Spinner />
			) : clients!.length === 0 ? (
				<Empty icon={<Building2 className="size-5" />} title="No clients yet">
					Add the companies you support to group their docs in one place.
				</Empty>
			) : shown.length === 0 ? (
				<p className="py-10 text-center text-sm text-zinc-500">No clients match “{q}”.</p>
			) : (
				<Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
					{shown.map((c) => (
						<a key={c.id} href={`#/clients/${c.id}`} className="group flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
							<ClientLogo name={c.name} logoUrl={imageUrl(c.logo_image_id)} size="sm" />
							<span className="min-w-0 flex-1 truncate font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{c.name}</span>
							<span className="w-20 shrink-0 text-right text-xs tabular-nums text-zinc-500">
								{c.article_count} {c.article_count === 1 ? 'KB' : 'KBs'}
							</span>
						</a>
					))}
				</Card>
			)}
			<ClientForm open={adding} onClose={() => setAdding(false)} onSaved={(id) => navigate(`/clients/${id}`)} />
		</>
	);
}

const blank = { name: '', logo_image_id: null as string | null };

export function ClientForm({ open, onClose, onSaved, client }: { open: boolean; onClose: () => void; onSaved: (id: number) => void; client?: Client }) {
	const { toast } = useFeedback();
	const [f, setF] = useState(blank);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (open) {
			setF(client ? { name: client.name, logo_image_id: client.logo_image_id } : blank);
			setError(null);
			setBusy(false);
		}
	}, [open, client]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const res = client ? await api.put(`/clients/${client.id}`, f) : await api.post('/clients', f);
			toast(client ? 'Client updated' : 'Client added');
			onClose();
			onSaved(res.id);
		} catch (err) {
			setError((err as Error).message);
			setBusy(false);
		}
	};

	return (
		<Modal open={open} onClose={onClose} title={client ? 'Edit client' : 'Add client'} wide>
			<form onSubmit={submit} className="space-y-4">
				<div>
					<span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Logo</span>
					<LogoPicker url={imageUrl(f.logo_image_id)} onChange={(id) => setF({ ...f, logo_image_id: id })} />
				</div>
				<Field label="Company name">
					<Input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
				</Field>
				<ErrorNote error={error} />
				<div className="flex justify-end gap-2">
					<Button type="button" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" loading={busy}>
						{client ? 'Save' : 'Add client'}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
