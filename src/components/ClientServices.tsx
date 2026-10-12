import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { api, type Service } from '../api';
import { Card, cx, useFeedback } from './ui';

// The services/software a client uses, as a slim row of chips. Each has a checkmark that editors can toggle;
// editors can also add and remove services. Every change saves straight away.
export function ClientServices({ clientId, services, canEdit }: { clientId: number; services: Service[]; canEdit: boolean }) {
	const { toast } = useFeedback();
	const [list, setList] = useState(services);
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState('');

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

	const add = (e: FormEvent) => {
		e.preventDefault();
		const n = name.trim();
		if (!n) return setAdding(false);
		if (list.some((s) => s.name.toLowerCase() === n.toLowerCase())) return toast(`${n} is already listed.`, 'error');
		setName('');
		save([...list, { name: n, on: false }]);
	};

	if (!canEdit && list.length === 0) return null;

	return (
		<Card className="mb-6 flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
			<span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Services</span>
			{list.length === 0 && !adding && <span className="text-zinc-500">None yet.</span>}
			{list.map((s, i) => (
				<span
					key={s.name}
					className={cx(
						'group inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5',
						s.on
							? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200'
							: 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
					)}
				>
					<button
						type="button"
						disabled={!canEdit}
						onClick={() => save(list.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
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
					{s.name}
					{canEdit && (
						<button
							type="button"
							onClick={() => save(list.filter((_, j) => j !== i))}
							title={`Remove ${s.name}`}
							className="-mr-1 text-zinc-400 hover:text-red-600"
						>
							<X className="size-3.5" />
						</button>
					)}
				</span>
			))}
			{canEdit &&
				(adding ? (
					<form onSubmit={add} className="inline-flex">
						<input
							autoFocus
							value={name}
							maxLength={60}
							onChange={(e) => setName(e.target.value)}
							onBlur={() => !name.trim() && setAdding(false)}
							onKeyDown={(e) => e.key === 'Escape' && (setName(''), setAdding(false))}
							placeholder="e.g. Dialpad"
							className="w-36 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm outline-none focus:border-brand-500 dark:border-zinc-600 dark:bg-zinc-900"
						/>
					</form>
				) : (
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-zinc-500 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-600"
					>
						<Plus className="size-3.5" /> Add
					</button>
				))}
		</Card>
	);
}
