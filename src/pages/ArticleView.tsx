import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Copy, CopyPlus, Link2, Pencil, Share2, Trash2 } from 'lucide-react';
import { api, type Article } from '../api';
import { fullDate, timeAgo } from '../format';
import { navigate } from '../router';
import { canEdit, useUser } from '../session';
import { Badge, Button, Card, Input, Markdown, Modal, Spinner, useFeedback } from '../components/ui';
import { ClientSidebar, lastListQuery } from '../components/ClientSidebar';

export function ArticleView({ id }: { id: number }) {
	const user = useUser();
	const { confirm, toast } = useFeedback();
	const [article, setArticle] = useState<Article | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sharing, setSharing] = useState(false);

	useEffect(() => {
		api.get<Article>(`/articles/${id}`).then(setArticle).catch((e) => setError(e.message));
	}, [id]);

	if (error)
		return (
			<div className="py-24 text-center">
				<h1 className="text-lg font-semibold">{error}</h1>
				<a href="#/articles" className="mt-3 inline-block text-sm font-medium text-brand-600">
					Back to knowledge base
				</a>
			</div>
		);
	if (!article) return <Spinner />;

	const remove = async () => {
		if (!(await confirm('Delete KB?', `"${article.title}" will be permanently deleted. This can't be undone.`))) return;
		try {
			await api.del(`/articles/${id}`);
			toast('KB deleted');
			navigate('/articles');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};

	const back = lastListQuery();
	const backHref = `#/articles${back.size ? '?' + back : ''}`;

	return (
		<div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
			{/* The Clients list stays on the left; picking one goes back to the list filtered to it. */}
			<aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
				<ClientSidebar
					active={back.get('client') ?? ''}
					onSelect={(client) => {
						const params = new URLSearchParams(client ? { client } : {});
						navigate(`/articles${params.size ? '?' + params : ''}`);
					}}
				/>
			</aside>
			<div className="mx-auto w-full min-w-0 max-w-3xl">
				<a href={backHref} className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
					<ArrowLeft className="size-4" /> Knowledge base
				</a>
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<Badge>{article.category}</Badge>
					{article.clients.map((c) => (
						<a key={c.id} href={`#/clients/${c.id}`}>
							<Badge tone="brand">
								<Building2 className="mr-1 size-3" />
								{c.name}
							</Badge>
						</a>
					))}
				</div>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
					<div className="flex shrink-0 gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								navigator.clipboard.writeText(location.href);
								toast('Link copied');
							}}
							title="Copy link (for people who can open this site)"
						>
							<Copy className="size-4" />
						</Button>
						{canEdit(user) && (
							<>
								<Button size="sm" onClick={() => setSharing(true)} title="Share with people who don't have an account">
									<Share2 className="size-4" /> Share
								</Button>
								<Button size="sm" onClick={() => navigate(`/articles/new?copy=${id}`)} title="Start a new KB with this one's content">
									<CopyPlus className="size-4" /> Copy
								</Button>
								<Button size="sm" onClick={() => navigate(`/articles/${id}/edit`)}>
									<Pencil className="size-4" /> Edit
								</Button>
							</>
						)}
						{user.role === 'admin' && (
							<Button size="sm" variant="ghost" onClick={remove} title="Delete" className="hover:text-red-600">
								<Trash2 className="size-4" />
							</Button>
						)}
					</div>
				</div>
				<p className="mt-3 text-sm text-zinc-500" title={fullDate(article.updated_at)}>
					Updated {timeAgo(article.updated_at)}
					{article.updated_by_name && ` by ${article.updated_by_name}`}
					{article.created_by_name && article.created_by_name !== article.updated_by_name && ` · Created by ${article.created_by_name}`}
				</p>
				<Card className="mt-6 p-6 sm:p-8">
					{article.body.trim() ? <Markdown source={article.body} /> : <p className="text-sm text-zinc-500">This KB is empty.</p>}
				</Card>
				<ShareDialog
					open={sharing}
					onClose={() => setSharing(false)}
					articleId={id}
					token={article.share_token ?? null}
					onChange={(share_token) => setArticle({ ...article, share_token })}
				/>
			</div>
		</div>
	);
}

const shareUrl = (token: string) => `${location.origin}/#/share/${token}`;

function ShareDialog({ open, onClose, articleId, token, onChange }: { open: boolean; onClose: () => void; articleId: number; token: string | null; onChange: (t: string | null) => void }) {
	const { toast } = useFeedback();
	const [busy, setBusy] = useState(false);
	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			toast((e as Error).message, 'error');
		}
		setBusy(false);
	};
	const create = () =>
		run(async () => {
			const r = await api.post<{ share_token: string }>(`/articles/${articleId}/share`);
			onChange(r.share_token);
			await navigator.clipboard.writeText(shareUrl(r.share_token)).catch(() => {});
			toast('Share link created and copied');
		});
	const turnOff = () =>
		run(async () => {
			await api.del(`/articles/${articleId}/share`);
			onChange(null);
			toast('Share link turned off');
		});

	return (
		<Modal open={open} onClose={onClose} title="Share this KB">
			{token ? (
				<div className="space-y-4">
					<p className="text-sm text-zinc-500">Anyone with this link can read this KB and its images, without an account. They can't see anything else.</p>
					<div className="flex gap-2">
						<Input readOnly value={shareUrl(token)} onFocus={(e) => e.target.select()} aria-label="Share link" />
						<Button
							variant="primary"
							onClick={() => {
								navigator.clipboard.writeText(shareUrl(token));
								toast('Link copied');
							}}
						>
							<Copy className="size-4" /> Copy
						</Button>
					</div>
					<div className="flex justify-between gap-2">
						<Button variant="ghost" onClick={turnOff} loading={busy} className="text-red-600! hover:text-red-700!">
							Turn off link
						</Button>
						<Button onClick={onClose}>Done</Button>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					<p className="text-sm text-zinc-500">
						Create a link that lets anyone read this KB without an account, for example to send to a client. You can turn it off at any time.
					</p>
					<div className="flex justify-end gap-2">
						<Button onClick={onClose}>Cancel</Button>
						<Button variant="primary" onClick={create} loading={busy}>
							<Link2 className="size-4" /> Create link
						</Button>
					</div>
				</div>
			)}
		</Modal>
	);
}
