import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- buttons & fields ----------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
	size?: 'sm' | 'md';
	loading?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
	return (
		<button
			{...rest}
			disabled={disabled || loading}
			className={cx(
				'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
				size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
				variant === 'primary' && 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600',
				variant === 'secondary' &&
					'border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
				variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
				variant === 'danger' && 'bg-red-600 text-white shadow-sm hover:bg-red-700',
				className,
			)}
		>
			{loading && <Loader2 className="size-4 animate-spin" />}
			{children}
		</button>
	);
}

const fieldClass =
	'w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-xs transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
			{children}
			{hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
		</label>
	);
}

export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => (
	<input {...p} className={cx(fieldClass, 'h-10', className)} />
);
// A password field with an eye button to show or hide what's typed.
export function PasswordInput({ className, ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
	const [show, setShow] = useState(false);
	return (
		<div className="relative">
			<input {...p} type={show ? 'text' : 'password'} className={cx(fieldClass, 'h-10 pr-10', className)} />
			<button
				type="button"
				onClick={() => setShow((v) => !v)}
				className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
				aria-label={show ? 'Hide password' : 'Show password'}
				title={show ? 'Hide password' : 'Show password'}
			>
				{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
			</button>
		</div>
	);
}
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
	<textarea {...p} className={cx(fieldClass, 'py-2', className)} />
);
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
	<select {...p} className={cx(fieldClass, 'h-10 pr-8', className)} />
);

// ---------- layout bits ----------

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
	return (
		<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				<h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
				{subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</div>
	);
}

export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
	<div className={cx('rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900', className)}>{children}</div>
);

export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'zinc' | 'brand' | 'green' | 'amber' }) {
	return (
		<span
			className={cx(
				'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
				tone === 'zinc' && 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
				tone === 'brand' && 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30',
				tone === 'green' && 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
				tone === 'amber' && 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
			)}
		>
			{children}
		</span>
	);
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
	return (
		<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-800">
			<div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">{icon}</div>
			<h3 className="font-medium text-zinc-900 dark:text-white">{title}</h3>
			{children && <div className="mt-1 max-w-sm text-sm text-zinc-500">{children}</div>}
		</div>
	);
}

export const Spinner = () => (
	<div className="flex justify-center py-16 text-zinc-400">
		<Loader2 className="size-6 animate-spin" />
	</div>
);

export function ErrorNote({ error }: { error: string | null }) {
	if (!error) return null;
	return (
		<div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
			<AlertTriangle className="mt-0.5 size-4 shrink-0" />
			{error}
		</div>
	);
}

// ---------- modal ----------

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[10vh]">
			<div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm animate-[fade_.15s_ease]" onClick={onClose} />
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={cx(
					'relative w-full rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900',
					wide ? 'max-w-2xl' : 'max-w-md',
				)}
			>
				<div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
					<h2 className="font-semibold">{title}</h2>
					<button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800" aria-label="Close">
						<X className="size-4" />
					</button>
				</div>
				<div className="p-5">{children}</div>
			</div>
		</div>
	);
}

// ---------- toasts & confirm ----------

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
type Confirm = { title: string; text: string; action: string; resolve: (ok: boolean) => void };
const FeedbackCtx = createContext<{ toast: (text: string, tone?: Toast['tone']) => void; confirm: (title: string, text: string, action?: string) => Promise<boolean> }>(
	null!,
);
export const useFeedback = () => useContext(FeedbackCtx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [pending, setPending] = useState<Confirm | null>(null);
	const next = useRef(0);
	const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
		const id = ++next.current;
		setToasts((t) => [...t, { id, text, tone }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
	}, []);
	const confirm = useCallback(
		(title: string, text: string, action = 'Delete') => new Promise<boolean>((resolve) => setPending({ title, text, action, resolve })),
		[],
	);
	const close = (ok: boolean) => {
		pending?.resolve(ok);
		setPending(null);
	};
	const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
	return (
		<FeedbackCtx.Provider value={value}>
			{children}
			<Modal open={!!pending} onClose={() => close(false)} title={pending?.title ?? ''}>
				<p className="text-sm text-zinc-600 dark:text-zinc-400">{pending?.text}</p>
				<div className="mt-5 flex justify-end gap-2">
					<Button onClick={() => close(false)}>Cancel</Button>
					<Button variant="danger" onClick={() => close(true)} autoFocus>
						{pending?.action}
					</Button>
				</div>
			</Modal>
			<div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
				{toasts.map((t) => (
					<div
						key={t.id}
						className="pointer-events-auto flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
					>
						{t.tone === 'ok' ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertTriangle className="size-4 text-red-500" />}
						{t.text}
					</div>
				))}
			</div>
		</FeedbackCtx.Provider>
	);
}

// ---------- markdown ----------

marked.setOptions({ gfm: true, breaks: true });

export const IMAGE_WIDTH = /#w=(\d{1,4})$/;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A') {
		node.setAttribute('target', '_blank');
		node.setAttribute('rel', 'noopener noreferrer');
	}
	// Resized images carry their width in the link, e.g. /api/images/abc#w=480 (see RichEditor).
	const width = node.tagName === 'IMG' && node.getAttribute('src')?.match(IMAGE_WIDTH)?.[1];
	if (width) node.setAttribute('width', width);
});

// Text colour and font size from the editor are stored as <span style="…">. Keep just those two, with plain values.
const STYLE_RULES: Record<string, RegExp> = {
	color: /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i,
	'font-size': /^\d{1,3}(\.\d+)?(px|em|rem|%)$/i,
};
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
	if (data.attrName !== 'style') return;
	const kept = data.attrValue
		.split(';')
		.map((rule) => rule.split(':').map((part) => part.trim()))
		.filter(([prop, value]) => prop && value && STYLE_RULES[prop.toLowerCase()]?.test(value))
		.map(([prop, value]) => `${prop.toLowerCase()}: ${value}`);
	if (kept.length) data.attrValue = kept.join('; ');
	else data.keepAttr = false;
});

// Markdown for a single line of text as HTML (used for indented paragraphs, which are stored as HTML).
export const inlineHtml = (md: string) => marked.parseInline(md, { async: false }) as string;

export const renderMarkdown = (md: string) => DOMPurify.sanitize(marked.parse(md, { async: false }) as string);
export const safeSnippet = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark'] });

// Typography for rendered KB content, shared by the reader and the editor so both look the same.
export const proseClass =
	'prose prose-zinc max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-brand-600 dark:prose-a:text-brand-300 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal dark:prose-code:bg-zinc-800 prose-pre:bg-zinc-900 dark:prose-pre:bg-black/40 prose-img:rounded-lg prose-img:border prose-img:border-zinc-200 dark:prose-img:border-zinc-800 prose-img:cursor-zoom-in prose-img:shadow-sm [&_pre_code]:bg-transparent! [&_pre_code]:p-0! [&_pre_code]:text-zinc-100! [&_blockquote_p]:before:content-none! [&_blockquote_p]:after:content-none! prose-blockquote:not-italic prose-blockquote:font-normal';

export function Markdown({ source, className }: { source: string; className?: string }) {
	const html = useMemo(() => renderMarkdown(source), [source]);
	const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);
	useEffect(() => {
		if (!zoomed) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoomed(null);
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [zoomed]);
	return (
		<>
			<div
				className={cx(
					proseClass,
					className,
				)}
				onClick={(e) => {
					const t = e.target as HTMLElement;
					if (t instanceof HTMLImageElement && !t.closest('a')) setZoomed({ src: t.src, alt: t.alt });
				}}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{zoomed && (
				<div className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm" onClick={() => setZoomed(null)}>
					<img src={zoomed.src} alt={zoomed.alt} className="max-h-full max-w-full rounded-lg shadow-2xl" />
					<a
						href={zoomed.src}
						target="_blank"
						rel="noreferrer"
						onClick={(e) => e.stopPropagation()}
						className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
					>
						Open original
					</a>
				</div>
			)}
		</>
	);
}
