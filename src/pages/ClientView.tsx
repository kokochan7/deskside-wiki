import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Info, Pencil, Trash2, UserPlus } from 'lucide-react';
import { api, imageUrl, type ClientDetail } from '../api';
import { ClientLogo } from '../branding';
import { plural, timeAgo } from '../format';
import { navigate } from '../router';
import { ClientSection } from '../components/ClientSection';
import { ClientServices } from '../components/ClientServices';
import { canEdit, useUser } from '../session';
import { Badge, Button, Card, Empty, Spinner, useFeedback } from '../components/ui';
import { ClientForm } from './ClientList';

export function ClientView({ id }: { id: number }) {
	const user = useUser();
	const editor = canEdit(user);
	const isAdmin = user.role === 'admin';
	const { confirm, toast } = useFeedback();
	const [client, setClient] = useState<ClientDetail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);

	const load = useCallback(() => api.get<ClientDetail>(`/clients/${id}`).then(setClient).catch((e) => setError(e.message)), [id]);
	useEffect(() => {
		load();
	}, [load]);

	if (error)
		return (
			<div className="py-24 text-center">
				<h1 className="text-lg font-semibold">{error}</h1>
				<a href="#/clients" className="mt-3 inline-block text-sm font-medium text-brand-600">
					Back to clients
				</a>
			</div>
		);
	if (!client) return <Spinner />;

	const remove = async () => {
		if (!(await confirm('Delete client?', `${client.name} will be deleted. Its KBs will be kept as internal KBs.`))) return;
		try {
			await api.del(`/clients/${id}`);
			toast('Client deleted');
			navigate('/clients');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};

	return (
		<>
			<a href="#/clients" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
				<ArrowLeft className="size-4" /> Clients
			</a>
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-4">
					<ClientLogo name={client.name} logoUrl={imageUrl(client.logo_image_id)} size="lg" />
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
						<p className="text-sm text-zinc-500">
							{plural(client.articles.length, 'KB')}
						</p>
					</div>
				</div>
				{editor && (
					<div className="flex gap-2">
						<Button onClick={() => setEditing(true)}>
							<Pencil className="size-4" /> Edit
						</Button>
						{isAdmin && (
							<Button variant="ghost" onClick={remove} title="Delete client" className="hover:text-red-600">
								<Trash2 className="size-4" />
							</Button>
						)}
					</div>
				)}
			</div>

			<ClientServices clientId={client.id} services={client.services} canEdit={editor} />

			<div className="grid gap-6 lg:grid-cols-2">
				<ClientSection
					clientId={client.id}
					section="info"
					title="Information"
					icon={<Info className="size-5" />}
					text={client.notes}
					canEdit={isAdmin}
					empty={isAdmin ? 'Nothing here yet. Add contract hours, key contacts, escalation paths and other important details.' : 'No information yet.'}
					placeholder="Key contacts, support hours, systems, escalation paths…"
					onSaved={(notes) => setClient({ ...client, notes })}
				/>
				<ClientSection
					clientId={client.id}
					section="new-hire"
					title="New Hire Procedure"
					icon={<UserPlus className="size-5" />}
					text={client.new_hire}
					canEdit={isAdmin}
					empty={isAdmin ? 'Nothing here yet. Write the steps for setting up a new employee at this client.' : 'No new hire procedure yet.'}
					placeholder="The steps for setting up a new employee at this client…"
					onSaved={(new_hire) => setClient({ ...client, new_hire })}
				/>
			</div>

			<section className="mt-8">
				<h2 className="mb-3 text-sm font-semibold text-zinc-500">KBs for {client.name}</h2>
				{client.articles.length === 0 ? (
					<Empty icon={<BookOpen className="size-5" />} title="No KBs for this client yet">
						Pick this client when you create a KB and it will show up here.
					</Empty>
				) : (
					<Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
						{client.articles.map((a) => (
							<a key={a.id} href={`#/articles/${a.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
								<span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
								<Badge>{a.category}</Badge>
								<span className="hidden text-xs text-zinc-400 sm:inline">{timeAgo(a.updated_at)}</span>
							</a>
						))}
					</Card>
				)}
			</section>

			<ClientForm open={editing} onClose={() => setEditing(false)} onSaved={() => load()} client={client} />
		</>
	);
}
