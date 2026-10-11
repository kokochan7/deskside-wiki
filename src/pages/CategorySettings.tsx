import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { Button, Card, Input, Spinner, useFeedback } from '../components/ui';

type Category = { name: string; count: number };

// Admins manage the list of categories technicians pick from.
export function CategorySettings() {
	const { confirm, toast } = useFeedback();
	const [list, setList] = useState<Category[] | null>(null);
	const [adding, setAdding] = useState('');
	const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
	const load = useCallback(() => api.get<Category[]>('/categories/usage').then(setList).catch(() => setList([])), []);
	useEffect(() => {
		load();
	}, [load]);

	const run = async (fn: () => Promise<unknown>, done: string) => {
		try {
			await fn();
			toast(done);
			load();
			return true;
		} catch (e) {
			toast((e as Error).message, 'error');
			return false;
		}
	};
	const add = async (e: FormEvent) => {
		e.preventDefault();
		if (adding.trim() && (await run(() => api.post('/categories', { name: adding }), 'Category added'))) setAdding('');
	};
	const rename = async (e: FormEvent) => {
		e.preventDefault();
		if (!editing) return;
		if (editing.to.trim() === editing.from) return setEditing(null);
		if (await run(() => api.put(`/categories/${encodeURIComponent(editing.from)}`, { name: editing.to }), 'Category renamed')) setEditing(null);
	};
	const remove = async (c: Category) => {
		const msg = c.count ? `Its ${c.count} article${c.count === 1 ? '' : 's'} will move to General.` : 'No articles use it.';
		if (await confirm(`Delete “${c.name}”?`, msg, 'Delete')) run(() => api.del(`/categories/${encodeURIComponent(c.name)}`), 'Category deleted');
	};

	return (
		<Card className="space-y-4 p-5">
			<div>
				<h2 className="font-semibold">Categories</h2>
				<p className="mt-0.5 text-sm text-zinc-500">Technicians pick from this list when writing articles. Renaming a category updates its articles.</p>
			</div>
			{!list ? (
				<Spinner />
			) : (
				<div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
					{list.map((c) =>
						editing?.from === c.name ? (
							<form key={c.name} onSubmit={rename} className="flex items-center gap-2 px-3 py-1.5">
								<Input autoFocus required maxLength={60} value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })} className="h-8!" />
								<Button size="sm" variant="primary" title="Save" aria-label="Save">
									<Check className="size-4" />
								</Button>
								<Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)} title="Cancel" aria-label="Cancel">
									<X className="size-4" />
								</Button>
							</form>
						) : (
							<div key={c.name} className="group flex items-center gap-3 px-3 py-2 text-sm">
								<span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
								<span className="text-xs tabular-nums text-zinc-500">
									{c.count} article{c.count === 1 ? '' : 's'}
								</span>
								{c.name === 'General' ? (
									<span className="w-[4.5rem] text-right text-xs text-zinc-400">Default</span>
								) : (
									<span className="flex w-[4.5rem] justify-end">
										<Button size="sm" variant="ghost" onClick={() => setEditing({ from: c.name, to: c.name })} title="Rename" aria-label={`Rename ${c.name}`}>
											<Pencil className="size-3.5" />
										</Button>
										<Button size="sm" variant="ghost" onClick={() => remove(c)} title="Delete" aria-label={`Delete ${c.name}`} className="hover:text-red-600">
											<Trash2 className="size-3.5" />
										</Button>
									</span>
								)}
							</div>
						),
					)}
				</div>
			)}
			<form onSubmit={add} className="flex gap-2">
				<Input value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={60} placeholder="New category name" aria-label="New category name" />
				<Button disabled={!adding.trim()}>
					<Plus className="size-4" /> Add
				</Button>
			</form>
		</Card>
	);
}
