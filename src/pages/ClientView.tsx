import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, FilePlus2, Globe, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { api, imageUrl, type ClientDetail } from '../api';
import { ClientLogo } from '../branding';
import { plural, timeAgo } from '../format';
import { navigate } from '../router';
import { canEdit, useUser } from '../session';
import { Badge, Button, Card, Empty, Markdown, Spinner, useFeedback } from '../components/ui';
import { ClientForm } from './ClientList';

export function ClientView({ id }: { id: number }) {
	const user = useUser();
	const editor = canEdit(user);
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
		if (!(await confirm('Delete client?', `${client.name} will be deleted. Its articles will be kept as internal articles.`))) return;
		try {
			await api.del(`/clients/${id}`);
			toast('Client deleted');
			navigate('/clients');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};
	const website = client.website && (client.website.startsWith('http') ? client.website : `https://${client.website}`);
	const details = [
		client.website && { icon: Globe, text: client.website, href: website },
		client.phone && { icon: Phone, text: client.phone, href: `tel:${client.phone}` },
		client.email && { icon: Mail, text: client.email, href: `mailto:${client.email}` },
		client.address && { icon: MapPin, text: client.address },
	].filter(Boolean) as { icon: typeof Globe; text: string; href?: string }[];

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
							{plural(client.articles.length, 'article')}
						</p>
					</div>
				</div>
				{editor && (
					<div className="flex gap-2">
						<Button onClick={() => setEditing(true)}>
							<Pencil className="size-4" /> Edit
						</Button>
						<Button variant="ghost" onClick={remove} title="Delete client" className="hover:text-red-600">
							<Trash2 className="size-4" />
						</Button>
					</div>
				)}
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<section>
						<div className="mb-3 flex items-center justify-between">
							<h2 className="text-sm font-semibold text-zinc-500">Articles for {client.name}</h2>
							{editor && (
								<Button size="sm" variant="ghost" onClick={() => navigate(`/articles/new?client=${client.id}`)}>
									<FilePlus2 className="size-4" /> New article
								</Button>
							)}
						</div>
						{client.articles.length === 0 ? (
							<Empty icon={<BookOpen className="size-5" />} title="No client articles yet">
								Document this client's network, setup and recurring fixes.
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
				</div>

				<aside className="space-y-6">
					<Card className="p-5">
						<h2 className="mb-3 text-sm font-semibold text-zinc-500">Details</h2>
						{details.length === 0 ? (
							<p className="text-sm text-zinc-500">No company details yet.</p>
						) : (
							<ul className="space-y-2.5 text-sm">
								{details.map((d) => (
									<li key={d.text} className="flex items-start gap-2.5">
										<d.icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
										{d.href ? (
											<a href={d.href} target={d.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="break-all hover:text-brand-600">
												{d.text}
											</a>
										) : (
											<span>{d.text}</span>
										)}
									</li>
								))}
							</ul>
						)}
					</Card>
					{client.notes && (
						<Card className="p-5">
							<h2 className="mb-3 text-sm font-semibold text-zinc-500">Notes</h2>
							<Markdown source={client.notes} className="prose-sm" />
						</Card>
					)}
				</aside>
			</div>

			<ClientForm open={editing} onClose={() => setEditing(false)} onSaved={() => load()} client={client} />
		</>
	);
}
