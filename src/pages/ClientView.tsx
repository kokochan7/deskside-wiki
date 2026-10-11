import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, FilePlus2, Globe, Mail, MapPin, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react';
import { api, type ClientDetail, type Contact } from '../api';
import { initials, plural, timeAgo } from '../format';
import { navigate } from '../router';
import { canEdit, useUser } from '../session';
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Markdown, Modal, Spinner, Textarea, useFeedback } from '../components/ui';
import { ClientForm } from './ClientList';

export function ClientView({ id }: { id: number }) {
	const user = useUser();
	const editor = canEdit(user);
	const { confirm, toast } = useFeedback();
	const [client, setClient] = useState<ClientDetail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	const [contact, setContact] = useState<Contact | 'new' | null>(null);

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
		if (!(await confirm('Delete client?', `${client.name} and its ${client.contacts.length} contacts will be deleted. Its articles will be kept as internal articles.`))) return;
		try {
			await api.del(`/clients/${id}`);
			toast('Client deleted');
			navigate('/clients');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};
	const removeContact = async (c: Contact) => {
		if (!(await confirm('Delete contact?', `${c.name} will be removed from ${client.name}.`))) return;
		try {
			await api.del(`/contacts/${c.id}`);
			toast('Contact deleted');
			load();
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
					<span className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-semibold text-white shadow-sm">
						{initials(client.name)}
					</span>
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
						<p className="text-sm text-zinc-500">
							{plural(client.contacts.length, 'contact')} · {plural(client.articles.length, 'article')}
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
							<h2 className="text-sm font-semibold text-zinc-500">Contacts</h2>
							{editor && (
								<Button size="sm" variant="ghost" onClick={() => setContact('new')}>
									<Plus className="size-4" /> Add contact
								</Button>
							)}
						</div>
						{client.contacts.length === 0 ? (
							<Empty icon={<UserRound className="size-5" />} title="No contacts yet">
								Add the people at {client.name} you work with.
							</Empty>
						) : (
							<Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
								{client.contacts.map((c) => (
									<div key={c.id} className="group flex items-start gap-3 px-5 py-4">
										<span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
											{initials(c.name)}
										</span>
										<div className="min-w-0 flex-1">
											<div className="font-medium">
												{c.name} {c.title && <span className="font-normal text-zinc-500">· {c.title}</span>}
											</div>
											<div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
												{c.email && (
													<a href={`mailto:${c.email}`} className="hover:text-brand-600">
														{c.email}
													</a>
												)}
												{c.phone && (
													<a href={`tel:${c.phone}`} className="hover:text-brand-600">
														{c.phone}
													</a>
												)}
											</div>
											{c.notes && <p className="mt-1 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{c.notes}</p>}
										</div>
										{editor && (
											<div className="flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
												<Button size="sm" variant="ghost" onClick={() => setContact(c)} title="Edit contact">
													<Pencil className="size-4" />
												</Button>
												<Button size="sm" variant="ghost" onClick={() => removeContact(c)} title="Delete contact" className="hover:text-red-600">
													<Trash2 className="size-4" />
												</Button>
											</div>
										)}
									</div>
								))}
							</Card>
						)}
					</section>

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
			<ContactForm clientId={client.id} contact={contact} onClose={() => setContact(null)} onSaved={load} />
		</>
	);
}

function ContactForm({ clientId, contact, onClose, onSaved }: { clientId: number; contact: Contact | 'new' | null; onClose: () => void; onSaved: () => void }) {
	const { toast } = useFeedback();
	const blank = { name: '', title: '', email: '', phone: '', notes: '' };
	const [f, setF] = useState(blank);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (!contact) return;
		setF(contact === 'new' ? blank : { name: contact.name, title: contact.title, email: contact.email, phone: contact.phone, notes: contact.notes });
		setError(null);
		setBusy(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [contact]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			if (contact === 'new') await api.post(`/clients/${clientId}/contacts`, f);
			else await api.put(`/contacts/${contact!.id}`, f);
			toast(contact === 'new' ? 'Contact added' : 'Contact updated');
			onClose();
			onSaved();
		} catch (err) {
			setError((err as Error).message);
			setBusy(false);
		}
	};

	return (
		<Modal open={!!contact} onClose={onClose} title={contact === 'new' ? 'Add contact' : 'Edit contact'}>
			<form onSubmit={submit} className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="Name">
						<Input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
					</Field>
					<Field label="Job title">
						<Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Office manager" />
					</Field>
					<Field label="Email">
						<Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
					</Field>
					<Field label="Phone">
						<Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
					</Field>
				</div>
				<Field label="Notes">
					<Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Primary contact for billing, prefers phone…" />
				</Field>
				<ErrorNote error={error} />
				<div className="flex justify-end gap-2">
					<Button type="button" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" loading={busy}>
						Save
					</Button>
				</div>
			</form>
		</Modal>
	);
}
