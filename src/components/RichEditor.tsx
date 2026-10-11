import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import Paragraph from '@tiptap/extension-paragraph';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import {
	AArrowDown,
	AArrowUp,
	AlignCenter,
	AlignLeft,
	AlignRight,
	Baseline,
	Bold,
	Check,
	Code,
	ImagePlus,
	IndentDecrease,
	IndentIncrease,
	Italic,
	Link2,
	List,
	ListChecks,
	ListOrdered,
	Loader2,
	Quote,
	Redo2,
	Strikethrough,
	Table,
	Undo2,
	type LucideIcon,
} from 'lucide-react';
import { altText, uploadImage } from '../images';
import { IMAGE_WIDTH, cx, inlineHtml, proseClass, useFeedback } from './ui';

// What-you-see-is-what-you-get editor. Content is still stored as Markdown, so existing KBs, search and
// share links keep working; people just never see the Markdown.
export function RichEditor({
	value,
	onChange,
	placeholder,
	onUploadingChange,
	className,
	autoFocus,
	compact,
}: {
	value: string;
	onChange: (markdown: string) => void;
	placeholder?: string;
	onUploadingChange?: (n: number) => void;
	className?: string;
	autoFocus?: boolean;
	compact?: boolean;
}) {
	const { toast } = useFeedback();
	const [uploading, setUploading] = useState(0);
	const fileInput = useRef<HTMLInputElement>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const insertRef = useRef<(files: File[], pos?: number) => void>(() => {});

	const editor = useEditor({
		extensions: [
			// Headings no longer have buttons, but older KBs use them, so they still load and save.
			StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true }, paragraph: false }),
			IndentParagraph,
			StyledText,
			Color,
			FontSize,
			TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right'] }),
			// breaks: a single line break is a new row, as in the reader (older KBs were typed that way).
			Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
			ResizableImage,
			TaskList,
			TaskItem.configure({ nested: true }),
			TableKit.configure({ table: { resizable: false } }),
			Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
		],
		content: value,
		contentType: 'markdown',
		autofocus: autoFocus ? 'end' : false,
		immediatelyRender: true,
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes: { class: cx(proseClass, compact && 'prose-sm', 'min-h-full px-5 py-4 outline-none [&_img]:inline-block') },
			// Screenshots pasted or dropped in are uploaded and inserted as images.
			handlePaste: (_view, event) => {
				const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
				// Plain text wins (e.g. cells copied from Excel also carry a picture of them).
				if (!files.length || event.clipboardData?.getData('text/plain').trim()) return false;
				insertRef.current(files);
				return true;
			},
			handleDrop: (view, event, _slice, moved) => {
				const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
				if (moved || !files.length) return false;
				const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
				insertRef.current(files, pos);
				return true;
			},
		},
		onUpdate: ({ editor }) => onChangeRef.current(tidy(editor.getMarkdown())),
	});

	insertRef.current = async (files, pos) => {
		if (!files.length) return;
		setUploading((n) => n + files.length);
		for (const file of files) {
			try {
				const { url } = await uploadImage(file);
				const at = pos ?? editor.state.selection.to;
				editor.chain().focus().insertContentAt(at, [{ type: 'image', attrs: { src: url, alt: altText(file) } }, { type: 'paragraph' }]).run();
				pos = undefined;
			} catch (e) {
				toast((e as Error).message, 'error');
			} finally {
				setUploading((n) => n - 1);
			}
		}
	};
	useEffect(() => onUploadingChange?.(uploading), [uploading, onUploadingChange]);

	return (
		<div className={cx('flex flex-col', className)}>
			<Toolbar editor={editor} onImage={() => fileInput.current?.click()} uploading={uploading} />
			<EditorContent editor={editor} className="flex-1 cursor-text" onClick={(e) => e.target === e.currentTarget && editor.commands.focus('end')} />
			<input
				ref={fileInput}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				multiple
				hidden
				onChange={(e) => {
					insertRef.current(Array.from(e.target.files ?? []));
					e.target.value = '';
				}}
			/>
		</div>
	);
}

// Empty paragraphs come out as &nbsp; lines; drop the ones left dangling at the end.
const tidy = (md: string) => md.replace(/(\s|&nbsp;)+$/, '');

// Images can be resized by dragging a corner. Markdown has no width syntax, so the width rides along in the
// link as #w=480; the reader turns that back into a width (see renderMarkdown in ui.tsx).
const ResizableImage = Image.extend({
	parseMarkdown: (token, helpers) => {
		const href: string = token.href ?? '';
		const width = href.match(IMAGE_WIDTH)?.[1];
		return helpers.createNode('image', { src: href.replace(IMAGE_WIDTH, ''), title: token.title, alt: token.text, width: width ? Number(width) : null });
	},
	renderMarkdown: (node) => {
		const { src = '', alt = '', title = '', width } = node.attrs ?? {};
		const href = width ? `${src}#w=${Math.round(width)}` : src;
		return title ? `![${alt}](${href} "${title}")` : `![${alt}](${href})`;
	},
}).configure({
	resize: { enabled: true, directions: ['bottom-right', 'bottom-left', 'top-right', 'top-left'], minWidth: 60, minHeight: 30, alwaysPreserveAspectRatio: true },
});

// Indented and aligned paragraphs. Markdown has neither, so such a paragraph is saved as
// <p data-indent="2" style="text-align: center">…</p>, which the reader shows as is (indent margins are in index.css).
const MAX_INDENT = 6;
const IndentParagraph = Paragraph.extend({
	addAttributes() {
		return {
			indent: {
				default: 0,
				parseHTML: (el) => Math.min(MAX_INDENT, Math.max(0, Number(el.getAttribute('data-indent')) || 0)),
				renderHTML: (attrs) => (attrs.indent ? { 'data-indent': attrs.indent } : {}),
			},
		};
	},
	renderMarkdown(node, h, ctx) {
		const { indent, textAlign } = node.attrs ?? {};
		const align = textAlign && textAlign !== 'left' ? textAlign : null;
		if (!indent && !align) return this.parent?.(node, h, ctx) ?? '';
		const attrs = [indent && ` data-indent="${indent}"`, align && ` style="text-align: ${align}"`].filter(Boolean).join('');
		return `<p${attrs}>${inlineHtml(h.renderChildren(node.content ?? []))}</p>`;
	},
});

// Text colour and font size, saved as <span style="color: …; font-size: …">. It ranks below bold, links etc. so the
// span always sits innermost (**<span>…</span>**), which is the form that reads back in.
const StyledText = TextStyle.extend({
	priority: 50,
	renderMarkdown: (node, h) => {
		const { color, fontSize } = node.attrs ?? {};
		const style = [color && `color: ${color}`, fontSize && `font-size: ${fontSize}`].filter(Boolean).join('; ');
		const inner = h.renderChildren(node);
		return style ? `<span style="${style}">${inner}</span>` : inner;
	},
});

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 30, 36];
const COLORS = [
	['Red', '#dc2626'],
	['Orange', '#ea580c'],
	['Amber', '#d97706'],
	['Green', '#16a34a'],
	['Teal', '#0d9488'],
	['Blue', '#2563eb'],
	['Purple', '#7c3aed'],
	['Pink', '#db2777'],
	['Grey', '#71717a'],
];

type Tool = { icon: LucideIcon; label: string; run: () => void; active?: boolean; disabled?: boolean } | 'sep' | 'color';

function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: () => void; uploading: number }) {
	// Re-render the toolbar (only) when the formatting at the cursor changes.
	const s = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			fontSize: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
			color: (e.getAttributes('textStyle').color as string | undefined) ?? '',
			align: (e.getAttributes('paragraph').textAlign as string | null) ?? 'left',
			canAlign: rowParagraphs(e.state.selection).length > 0,
			canIndent: canIndent(e, 1),
			canOutdent: canIndent(e, -1),
			bold: e.isActive('bold'),
			italic: e.isActive('italic'),
			strike: e.isActive('strike'),
			code: e.isActive('code'),
			link: e.isActive('link'),
			bullet: e.isActive('bulletList'),
			ordered: e.isActive('orderedList'),
			task: e.isActive('taskList'),
			quote: e.isActive('blockquote'),
			table: e.isActive('table'),
			undo: e.can().undo(),
			redo: e.can().redo(),
		}),
	});
	const chain = () => editor.chain().focus();
	const setLink = () => {
		const prev = editor.getAttributes('link').href as string | undefined;
		const url = window.prompt('Link address', prev ?? 'https://');
		if (url === null) return;
		if (!url.trim()) chain().extendMarkRange('link').unsetLink().run();
		else chain().extendMarkRange('link').setLink({ href: url.trim() }).run();
	};
	const setSize = (px: number | null) => (px ? chain().setFontSize(`${px}px`).run() : chain().unsetFontSize().run());
	const current = parseFloat(s.fontSize) || 16;
	const tools: Tool[] = [
		{ icon: AArrowDown, label: 'Decrease font size', run: () => setSize([...FONT_SIZES].reverse().find((n) => n < current) ?? null), disabled: current <= FONT_SIZES[0] },
		{ icon: AArrowUp, label: 'Increase font size', run: () => setSize(FONT_SIZES.find((n) => n > current) ?? null), disabled: current >= FONT_SIZES.at(-1)! },
		'sep',
		{ icon: Bold, label: 'Bold', run: () => chain().toggleBold().run(), active: s.bold },
		{ icon: Italic, label: 'Italic', run: () => chain().toggleItalic().run(), active: s.italic },
		{ icon: Strikethrough, label: 'Strikethrough', run: () => chain().toggleStrike().run(), active: s.strike },
		{ icon: Code, label: 'Code', run: () => chain().toggleCode().run(), active: s.code },
		{ icon: Link2, label: 'Link', run: setLink, active: s.link },
		'color',
		'sep',
		{ icon: List, label: 'Bulleted list', run: () => chain().toggleBulletList().run(), active: s.bullet },
		{ icon: ListOrdered, label: 'Numbered list', run: () => chain().toggleOrderedList().run(), active: s.ordered },
		{ icon: ListChecks, label: 'Checklist', run: () => chain().toggleTaskList().run(), active: s.task },
		{ icon: AlignLeft, label: 'Align left', run: () => align(editor, 'left'), active: s.canAlign && s.align === 'left', disabled: !s.canAlign },
		{ icon: AlignCenter, label: 'Center', run: () => align(editor, 'center'), active: s.align === 'center', disabled: !s.canAlign },
		{ icon: AlignRight, label: 'Align right', run: () => align(editor, 'right'), active: s.align === 'right', disabled: !s.canAlign },
		{ icon: IndentDecrease, label: 'Decrease indent', run: () => indent(editor, -1), disabled: !s.canOutdent },
		{ icon: IndentIncrease, label: 'Increase indent', run: () => indent(editor, 1), disabled: !s.canIndent },
		{ icon: Quote, label: 'Quote', run: () => chain().toggleBlockquote().run(), active: s.quote },
		{ icon: Table, label: 'Insert table', run: () => chain().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(), disabled: s.table },
		{ icon: ImagePlus, label: 'Insert image', run: onImage },
		'sep',
		{ icon: Undo2, label: 'Undo', run: () => chain().undo().run(), disabled: !s.undo },
		{ icon: Redo2, label: 'Redo', run: () => chain().redo().run(), disabled: !s.redo },
	];
	return (
		<div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-white/95 px-2 py-1.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
			<FontSizeSelect value={s.fontSize} onChange={setSize} />
			{tools.map((t, i) =>
				t === 'sep' ? (
					<span key={i} className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
				) : t === 'color' ? (
					<ColorPicker key={t} editor={editor} value={s.color} />
				) : (
					<button
						key={t.label}
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={t.run}
						disabled={t.disabled}
						title={t.label}
						aria-label={t.label}
						aria-pressed={t.active}
						className={cx(
							'rounded-md p-1.5 disabled:opacity-35',
							t.active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
						)}
					>
						<t.icon className="size-4" />
					</button>
				),
			)}
			{s.table && <TableTools editor={editor} />}
			{uploading > 0 && (
				<span className="ml-auto inline-flex items-center gap-1 pr-1 text-xs text-brand-600 dark:text-brand-300">
					<Loader2 className="size-3 animate-spin" /> Uploading {uploading} image{uploading === 1 ? '' : 's'}…
				</span>
			)}
		</div>
	);
}

// Indent and alignment change whole paragraphs. A paragraph can hold several rows (line breaks), so the rows the
// selection touches are first split off into their own paragraph: only what was selected changes.
function listItemType(e: Editor) {
	return e.isActive('taskItem') ? 'taskItem' : e.isActive('listItem') ? 'listItem' : null;
}
// Top-level paragraphs in the selection (not list items, quotes or table cells).
function rowParagraphs(selection: Transaction['selection']) {
	const found: { pos: number; node: ProseMirrorNode }[] = [];
	selection.$from.doc.nodesBetween(selection.from, selection.to, (node, pos, parent) => {
		if (node.type.name === 'paragraph' && parent?.type.name === 'doc') found.push({ pos, node });
		return node.type.name === 'doc';
	});
	return found;
}
function splitOffSelectedRows(tr: Transaction) {
	const { $from, $to } = tr.selection;
	const cuts: number[] = [];
	if ($from.parent.type.name === 'paragraph' && $from.depth === 1) {
		let cut: number | null = null;
		$from.parent.forEach((child, offset) => {
			if (child.type.name === 'hardBreak' && offset < $from.parentOffset) cut = $from.start() + offset;
		});
		if (cut !== null) cuts.push(cut);
	}
	if ($to.parent.type.name === 'paragraph' && $to.depth === 1) {
		let cut: number | null = null;
		$to.parent.forEach((child, offset) => {
			if (cut === null && child.type.name === 'hardBreak' && offset >= $to.parentOffset) cut = $to.start() + offset;
		});
		if (cut !== null) cuts.push(cut);
	}
	// Last first, so earlier positions stay valid. The break itself becomes the paragraph boundary.
	for (const pos of cuts.sort((x, y) => y - x)) tr.delete(pos, pos + 1).split(pos);
}
function updateRows(e: Editor, attrs: (node: ProseMirrorNode) => Record<string, unknown>) {
	e.chain()
		.focus()
		.command(({ tr }) => {
			splitOffSelectedRows(tr);
			const rows = rowParagraphs(tr.selection);
			for (const { pos, node } of rows) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs(node) });
			return rows.length > 0;
		})
		.run();
}
function canIndent(e: Editor, dir: 1 | -1) {
	const item = listItemType(e);
	if (item) return dir > 0 ? e.can().sinkListItem(item) : e.can().liftListItem(item);
	return rowParagraphs(e.state.selection).some(({ node }) => (dir > 0 ? node.attrs.indent < MAX_INDENT : node.attrs.indent > 0));
}
function indent(e: Editor, dir: 1 | -1) {
	const item = listItemType(e);
	if (item) return dir > 0 ? e.chain().focus().sinkListItem(item).run() : e.chain().focus().liftListItem(item).run();
	updateRows(e, (node) => ({ indent: Math.min(MAX_INDENT, Math.max(0, (node.attrs.indent ?? 0) + dir)) }));
}
function align(e: Editor, to: 'left' | 'center' | 'right') {
	updateRows(e, () => ({ textAlign: to === 'left' ? null : to }));
}

function FontSizeSelect({ value, onChange }: { value: string; onChange: (px: number | null) => void }) {
	const px = parseFloat(value);
	const sizes = px && !FONT_SIZES.includes(px) ? [...FONT_SIZES, px].sort((a, b) => a - b) : FONT_SIZES;
	return (
		<select
			value={px || ''}
			onChange={(e) => onChange(Number(e.target.value) || null)}
			title="Font size"
			aria-label="Font size"
			className="mr-0.5 h-7 rounded-md border border-zinc-200 bg-white pr-6 pl-2 text-xs text-zinc-700 outline-none hover:border-zinc-300 focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
		>
			<option value="">Normal size</option>
			{sizes.map((n) => (
				<option key={n} value={n}>
					{n}
				</option>
			))}
		</select>
	);
}

function ColorPicker({ editor, value }: { editor: Editor; value: string }) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
		const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', esc);
		};
	}, [open]);
	const pick = (color: string | null) => {
		if (color) editor.chain().focus().setColor(color).run();
		else editor.chain().focus().unsetColor().run();
		setOpen(false);
	};
	const swatch = 'grid size-6 place-items-center rounded-full ring-offset-1 hover:scale-110 dark:ring-offset-zinc-900';
	return (
		<span ref={ref} className="relative">
			<button
				type="button"
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => setOpen((o) => !o)}
				title="Text colour"
				aria-label="Text colour"
				aria-expanded={open}
				className={cx(
					'flex flex-col items-center rounded-md px-1.5 pt-1 pb-0.5',
					open ? 'bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
				)}
			>
				<Baseline className="size-4" />
				<span className="mt-px h-0.5 w-4 rounded-full" style={{ background: value || 'currentColor' }} />
			</button>
			{open && (
				<div className="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
					<div className="grid grid-cols-5 gap-1.5">
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => pick(null)}
							title="Default colour"
							aria-label="Default colour"
							className={cx(swatch, 'border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800', !value && 'ring-2 ring-zinc-900 dark:ring-white')}
						>
							<span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">A</span>
						</button>
						{COLORS.map(([name, hex]) => (
							<button
								key={hex}
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => pick(hex)}
								title={name}
								aria-label={name}
								className={cx(swatch, value.toLowerCase() === hex && 'ring-2 ring-zinc-900 dark:ring-white')}
								style={{ background: hex }}
							>
								{value.toLowerCase() === hex && <Check className="size-3.5 text-white" />}
							</button>
						))}
					</div>
				</div>
			)}
		</span>
	);
}

function TableTools({ editor }: { editor: Editor }) {
	const chain = () => editor.chain().focus();
	const actions: [string, () => void][] = [
		['+ Row', () => chain().addRowAfter().run()],
		['+ Column', () => chain().addColumnAfter().run()],
		['− Row', () => chain().deleteRow().run()],
		['− Column', () => chain().deleteColumn().run()],
		['Delete table', () => chain().deleteTable().run()],
	];
	return (
		<span className="ml-1 flex flex-wrap items-center gap-0.5 border-l border-zinc-200 pl-1.5 dark:border-zinc-700">
			{actions.map(([label, run]) => (
				<button
					key={label}
					type="button"
					onMouseDown={(e) => e.preventDefault()}
					onClick={run}
					className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
				>
					{label}
				</button>
			))}
		</span>
	);
}
