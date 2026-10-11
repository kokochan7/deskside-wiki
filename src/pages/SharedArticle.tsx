import { useEffect, useState } from 'react';
import { Building2, Link2Off } from 'lucide-react';
import { api } from '../api';
import { BrandMark, useBranding } from '../branding';
import { fullDate } from '../format';
import { Badge, Card, Markdown, Spinner } from '../components/ui';

type Shared = { title: string; body: string; category: string; tags: string; updated_at: string; clients: { id: number; name: string }[] };

// Read-only page for an article opened from a share link. Works without an account.
export function SharedArticle({ token }: { token: string }) {
	const { settings } = useBranding();
	const [article, setArticle] = useState<Shared | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api.get<Shared>(`/share/${encodeURIComponent(token)}`)
			.then((a) => {
				setArticle(a);
				document.title = `${a.title} · ${settings.site_name}`;
			})
			.catch((e) => setError(e.message));
	}, [token, settings.site_name]);

	return (
		<div className="min-h-screen">
			<header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
				<div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3 sm:px-8">
					<BrandMark className="size-7 rounded-md" />
					<span className="truncate font-semibold tracking-tight">{settings.site_name}</span>
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
				{error ? (
					<div className="py-24 text-center">
						<Link2Off className="mx-auto mb-3 size-8 text-zinc-400" />
						<h1 className="text-lg font-semibold">{error}</h1>
						<p className="mt-1 text-sm text-zinc-500">Ask whoever sent it for a new link.</p>
					</div>
				) : !article ? (
					<Spinner />
				) : (
					<>
						<div className="mb-2 flex flex-wrap items-center gap-2">
							<Badge>{article.category}</Badge>
							{article.clients.map((c) => (
								<Badge key={c.id} tone="brand">
									<Building2 className="mr-1 size-3" />
									{c.name}
								</Badge>
							))}
						</div>
						<h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
						<p className="mt-3 text-sm text-zinc-500">Updated {fullDate(article.updated_at)}</p>
						<Card className="mt-6 p-6 sm:p-8">
							{article.body.trim() ? (
								<Markdown source={article.body.replaceAll('/api/images/', `/api/share/${token}/images/`)} />
							) : (
								<p className="text-sm text-zinc-500">This KB is empty.</p>
							)}
						</Card>
					</>
				)}
			</main>
		</div>
	);
}
