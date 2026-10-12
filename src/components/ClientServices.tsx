import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { api, type Service } from '../api';
import { Card, cx, useFeedback } from './ui';

const OTHER = 'Other';
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const catOf = (s: Service) => s.category?.trim() || OTHER;

// Categories A–Z with Other last, and services A–Z within each.
function groupServices(list: Service[]) {
	const groups = new Map<string, Service[]>();
	for (const s of list) groups.set(catOf(s), [...(groups.get(catOf(s)) ?? []), s]);
	return [...groups.entries()]
		.sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : byName(a, b)))
		.map(([category, items]) => ({ category, items: items.sort((a, b) => byName(a.name, b.name)) }));
}

const inputClass =
	'rounded-full border border-zinc-300 bg-white px-3 py-0.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-600 dark:bg-zinc-900';

// The services/software a client uses, grouped by category. Each has a checkmark that editors can toggle;
// editors can also add, rename, recategorize and remove services. Every change saves straight away.
export function ClientServices({ clientId, services, canEdit }: { clientId: number; services: Service[]; canEdit: boolean }) {
	const { toast } = useFeedback();
	const [list, setList] = useState(services);
	// What's being typed: a new service (in a category, or a new category), or an edit of an existing one.
	const [draft, setDraft] = useState<{ original?: string; name: string; category: string; newCategory?: boolean } | null>(null);

	useEffect(() => setList(services), [services]);

	const save = async (next: Service[]) => {
		const prev = list;
		setList(next);
		try {
			await api.put(`/clients/${clientId}/services`, { services: next });
		} catch (e) {
			setList(prev);
			toast((e as Error).message, 'error');
		}
	};

	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!draft) return;
		const name = draft.name.trim();
		const category = draft.category.trim();
		const cat = category.toLowerCase() === OTHER.toLowerCase() ? '' : category;
		if (!name) return setDraft(null);
		if (list.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.name !== draft.original)) return toast(`${name} is already listed.`, 'error');
		setDraft(null);
		if (draft.original) save(list.map((s) => (s.name === draft.original ? { ...s, name, category: cat } : s)));
		else save([...list, { name, on: false, category: cat }]);
	};
	const cancel = (e: React.KeyboardEvent) => e.key === 'Escape' && setDraft(null);

	if (!canEdit && list.length === 0) return null;
	const groups = groupServices(list);
	const categories = groups.map((g) => g.category).filter((c) => c !== OTHER);

	const draftForm = (opts: { showCategory: boolean }) => (
		<form onSubmit={submit} onKeyDown={cancel} className="inline-flex flex-wrap items-center gap-1.5">
			{opts.showCategory && (
				<input
					autoFocus={draft?.newCategory}
					value={draft!.category}
					maxLength={40}
					list="service-categories"
					onChange={(e) => setDraft({ ...draft!, category: e.target.value })}
					placeholder="Category, e.g. Phone"
					aria-label="Category"
					className={cx(inputClass, 'w-44')}
				/>
			)}
			<input
				autoFocus={!draft?.newCategory}
				value={draft!.name}
				maxLength={60}
				onChange={(e) => setDraft({ ...draft!, name: e.target.value })}
				placeholder="e.g. Dialpad"
				aria-label="Service name"
				className={cx(inputClass, 'w-36')}
			/>
			<button type="submit" title="Save" className="grid size-6 place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-700">
				<Check className="size-3.5" />
			</button>
			<button type="button" title="Cancel" onClick={() => setDraft(null)} className="grid size-6 place-items-center rounded-full text-zinc-400 hover:text-zinc-700">
				<X className="size-3.5" />
			</button>
		</form>
	);

	return (
		<Card className="mb-6 px-4 py-2.5 text-sm">
			<datalist id="service-categories">
				{categories.map((c) => (
					<option key={c} value={c} />
				))}
			</datalist>
			<div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Services</div>
			{list.length === 0 && !draft && <p className="py-1 text-zinc-500">None yet.</p>}
			<div className="divide-y divide-zinc-100 dark:divide-zinc-800">
				{groups.map((g) => (
					<div key={g.category} className="flex flex-col gap-1.5 py-1.5 sm:flex-row sm:items-center">
						<span className="w-36 shrink-0 truncate text-xs font-semibold text-zinc-700 dark:text-zinc-300">{g.category}</span>
						<div className="flex flex-wrap items-center gap-2">
							{g.items.map((s) =>
								draft?.original === s.name ? (
									<span key={s.name}>{draftForm({ showCategory: true })}</span>
								) : (
									<span
										key={s.name}
										className={cx(
											'inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-1.5 pr-2.5',
											s.on
												? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200'
												: 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
										)}
									>
										<button
											type="button"
											disabled={!canEdit}
											onClick={() => save(list.map((x) => (x.name === s.name ? { ...x, on: !x.on } : x)))}
											title={canEdit ? (s.on ? 'Uncheck' : 'Check') : undefined}
											aria-label={`${s.name}: ${s.on ? 'checked' : 'not checked'}`}
											aria-pressed={s.on}
											className={cx(
												'grid size-4 place-items-center rounded border',
												s.on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900',
												canEdit && 'cursor-pointer',
											)}
										>
											{s.on && <Check className="size-3" strokeWidth={3} />}
										</button>
										{canEdit ? (
											<button
												type="button"
												onClick={() => setDraft({ original: s.name, name: s.name, category: s.category ?? '' })}
												title="Rename or change category"
												className="hover:underline"
											>
												{s.name}
											</button>
										) : (
											s.name
										)}
										{canEdit && (
											<button
												type="button"
												onClick={() => save(list.filter((x) => x.name !== s.name))}
												title={`Remove ${s.name}`}
												className="-mr-1 text-zinc-400 hover:text-red-600"
											>
												<X className="size-3.5" />
											</button>
										)}
									</span>
								),
							)}
							{canEdit &&
								(draft && !draft.original && !draft.newCategory && catOf(draft as Service) === g.category ? (
									draftForm({ showCategory: false })
								) : (
									<button
										type="button"
										onClick={() => setDraft({ name: '', category: g.category === OTHER ? '' : g.category })}
										title={`Add to ${g.category}`}
										aria-label={`Add to ${g.category}`}
										className="grid size-6 place-items-center rounded-full border border-dashed border-zinc-300 text-zinc-500 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-600"
									>
										<Plus className="size-3.5" />
									</button>
								))}
						</div>
					</div>
				))}
			</div>
			{canEdit && (
				<div className="pt-1.5">
					{draft?.newCategory ? (
						draftForm({ showCategory: true })
					) : (
						<button
							type="button"
							onClick={() => setDraft({ name: '', category: '', newCategory: true })}
							className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-0.5 text-zinc-500 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-600"
						>
							<Plus className="size-3.5" /> Add service
						</button>
					)}
				</div>
			)}
		</Card>
	);
}
