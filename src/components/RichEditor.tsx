import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import {
	Bold,
	Code,
	Heading2,
	Heading3,
	ImagePlus,
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
import { cx, proseClass, useFeedback } from './ui';

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
			StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true } }),
			Markdown,
			Image,
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

type Tool = { icon: LucideIcon; label: string; run: () => void; active?: boolean; disabled?: boolean } | 'sep';

function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: () => void; uploading: number }) {
	// Re-render the toolbar (only) when the formatting at the cursor changes.
	const s = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			h2: e.isActive('heading', { level: 2 }),
			h3: e.isActive('heading', { level: 3 }),
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
	const tools: Tool[] = [
		{ icon: Heading2, label: 'Heading', run: () => chain().toggleHeading({ level: 2 }).run(), active: s.h2 },
		{ icon: Heading3, label: 'Subheading', run: () => chain().toggleHeading({ level: 3 }).run(), active: s.h3 },
		'sep',
		{ icon: Bold, label: 'Bold', run: () => chain().toggleBold().run(), active: s.bold },
		{ icon: Italic, label: 'Italic', run: () => chain().toggleItalic().run(), active: s.italic },
		{ icon: Strikethrough, label: 'Strikethrough', run: () => chain().toggleStrike().run(), active: s.strike },
		{ icon: Code, label: 'Code', run: () => chain().toggleCode().run(), active: s.code },
		{ icon: Link2, label: 'Link', run: setLink, active: s.link },
		'sep',
		{ icon: List, label: 'Bulleted list', run: () => chain().toggleBulletList().run(), active: s.bullet },
		{ icon: ListOrdered, label: 'Numbered list', run: () => chain().toggleOrderedList().run(), active: s.ordered },
		{ icon: ListChecks, label: 'Checklist', run: () => chain().toggleTaskList().run(), active: s.task },
		{ icon: Quote, label: 'Quote', run: () => chain().toggleBlockquote().run(), active: s.quote },
		{ icon: Table, label: 'Insert table', run: () => chain().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(), disabled: s.table },
		{ icon: ImagePlus, label: 'Insert image', run: onImage },
		'sep',
		{ icon: Undo2, label: 'Undo', run: () => chain().undo().run(), disabled: !s.undo },
		{ icon: Redo2, label: 'Redo', run: () => chain().redo().run(), disabled: !s.redo },
	];
	return (
		<div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-white/95 px-2 py-1.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
			{tools.map((t, i) =>
				t === 'sep' ? (
					<span key={i} className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
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
