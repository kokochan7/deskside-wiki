import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Copy, Pencil, Trash2 } from 'lucide-react';
import { api, type Article } from '../api';
import { fullDate, timeAgo } from '../format';
import { navigate } from '../router';
import { canEdit, useUser } from '../session';
import { Badge, Button, Card, Markdown, Spinner, useFeedback } from '../components/ui';

export function ArticleView({ id }: { id: number }) {
	const user = useUser();
	const { confirm, toast } = useFeedback();
	const [article, setArticle] = useState<Article | null>(null);
	const [error, setError] = useState<string | null>(null);

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
		if (!(await confirm('Delete article?', `"${article.title}" will be permanently deleted. This can't be undone.`))) return;
		try {
			await api.del(`/articles/${id}`);
			toast('Article deleted');
			navigate('/articles');
		} catch (e) {
			toast((e as Error).message, 'error');
		}
	};

	return (
		<div className="mx-auto max-w-3xl">
			<a href="#/articles" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
				<ArrowLeft className="size-4" /> Knowledge base
			</a>
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<Badge>{article.category}</Badge>
				{article.client_name && (
					<a href={`#/clients/${article.client_id}`}>
						<Badge tone="brand">
							<Building2 className="mr-1 size-3" />
							{article.client_name}
						</Badge>
					</a>
				)}
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
						title="Copy link"
					>
						<Copy className="size-4" />
					</Button>
					{canEdit(user) && (
						<>
							<Button size="sm" onClick={() => navigate(`/articles/${id}/edit`)}>
								<Pencil className="size-4" /> Edit
							</Button>
							<Button size="sm" variant="ghost" onClick={remove} title="Delete" className="hover:text-red-600">
								<Trash2 className="size-4" />
							</Button>
						</>
					)}
				</div>
			</div>
			<p className="mt-3 text-sm text-zinc-500" title={fullDate(article.updated_at)}>
				Updated {timeAgo(article.updated_at)}
				{article.updated_by_name && ` by ${article.updated_by_name}`}
				{article.created_by_name && article.created_by_name !== article.updated_by_name && ` · Created by ${article.created_by_name}`}
			</p>
			<Card className="mt-6 p-6 sm:p-8">
				{article.body.trim() ? <Markdown source={article.body} /> : <p className="text-sm text-zinc-500">This article is empty.</p>}
			</Card>
			{article.tags && (
				<div className="mt-4 flex flex-wrap gap-1.5">
					{article.tags.split(',').map((t) => (
						<a key={t} href={`#/articles?q=${encodeURIComponent(t.trim())}`}>
							<Badge>#{t.trim()}</Badge>
						</a>
					))}
				</div>
			)}
		</div>
	);
}
