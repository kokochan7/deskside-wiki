import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { imageUrl, type Client } from '../api';
import { ClientLogo } from '../branding';
import { cx } from './ui';

// Pick any number of clients from a dropdown list of checkboxes.
export function ClientPicker({ clients, value, onChange, placeholder = 'Select clients…' }: { clients: Client[]; value: number[]; onChange: (ids: number[]) => void; placeholder?: string }) {
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState('');
	const box = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
		const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', esc);
		};
	}, [open]);
	useEffect(() => setQ(''), [open]);

	const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
	const shown = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
	const selected = clients.filter((c) => value.includes(c.id));

	return (
		<div ref={box} className="relative">
			<div
				role="button"
				tabIndex={0}
				onClick={() => setOpen((o) => !o)}
				onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o))}
				className={cx(
					'flex min-h-10 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border bg-white py-1.5 pl-2 pr-8 text-sm dark:bg-zinc-900',
					open ? 'border-brand-400 ring-3 ring-brand-500/15' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
				)}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				{selected.length === 0 && <span className="px-1 text-zinc-400">{placeholder}</span>}
				{selected.map((c) => (
					<span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
						{c.name}
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								toggle(c.id);
							}}
							className="rounded p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/25"
							aria-label={`Remove ${c.name}`}
						>
							<X className="size-3" />
						</button>
					</span>
				))}
				<ChevronDown className={cx('pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400 transition', open && 'rotate-180')} />
			</div>
			{open && (
				<div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
					{clients.length > 6 && (
						<div className="relative border-b border-zinc-100 dark:border-zinc-800">
							<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
							<input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client…" className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none" />
						</div>
					)}
					<div role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1">
						{shown.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">{clients.length ? 'No matching clients.' : 'No clients yet.'}</p>}
						{shown.map((c) => {
							const on = value.includes(c.id);
							return (
								// A button, not a label around a hidden checkbox: focusing that checkbox scrolled the dropdown's
								// contents out of sight when picking clients near the bottom of a long list.
								<button
									key={c.id}
									type="button"
									role="option"
									aria-selected={on}
									onClick={() => toggle(c.id)}
									className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
								>
									<span
										className={cx(
											'grid size-4 shrink-0 place-items-center rounded border',
											on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 dark:border-zinc-600',
										)}
									>
										{on && <Check className="size-3" strokeWidth={3} />}
									</span>
									<ClientLogo name={c.name} logoUrl={imageUrl(c.logo_image_id)} size="sm" />
									<span className="truncate">{c.name}</span>
								</button>
							);
						})}
					</div>
					{value.length > 0 && (
						<div className="flex items-center justify-between border-t border-zinc-100 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800">
							{value.length} selected
							<button type="button" onClick={() => onChange([])} className="font-medium text-brand-600 hover:underline">
								Clear
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
