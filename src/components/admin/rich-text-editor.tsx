'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';

import type { TiptapDocument } from '@/domain/types';
import { uploadMediaAction } from '@/lib/actions/media';

const emptyDoc: TiptapDocument = { type: 'doc', content: [] };

type EditorStatus = 'idle' | 'uploading' | 'upload-error';
type EditorMode = 'rich-text' | 'markdown';

function ToolbarButton({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex h-8 min-w-8 items-center justify-center border px-2 text-xs transition-colors ${
        active
          ? 'border-rust bg-rust text-paper dark:border-rust-soft dark:bg-rust-soft dark:text-night'
          : 'border-rule text-ink-soft hover:border-rust hover:text-rust dark:border-night-rule dark:text-cream-soft dark:hover:border-rust-soft dark:hover:text-rust-soft'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({
  initialContent = emptyDoc,
  onChange,
}: {
  initialContent?: TiptapDocument;
  onChange: (doc: TiptapDocument) => void;
}) {
  const [, setTick] = useState(0);
  const [status, setStatus] = useState<EditorStatus>('idle');
  const [mode, setMode] = useState<EditorMode>('rich-text');
  const [markdownSource, setMarkdownSource] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Tiptap v3 的 StarterKit 已内置 Link，直接在此配置，避免重复注册同名扩展。
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' },
        },
      }),
      Image,
      Placeholder.configure({ placeholder: '从这里开始写作……' }),
      Markdown,
    ],
    content: initialContent,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON() as TiptapDocument);
    },
  });

  // 选区变化时刷新工具栏高亮。
  useEffect(() => {
    if (!editor) {
      return;
    }

    const refresh = () => setTick((value) => value + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  function setLink() {
    if (!editor) {
      return;
    }

    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('链接地址（http/https/mailto）', previous ?? 'https://');

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  async function uploadFile(file: File) {
    if (!editor || !file) {
      return;
    }

    setStatus('uploading');
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadMediaAction(formData);

    if (result.ok) {
      editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
      setStatus('idle');
    } else {
      setStatus('upload-error');
    }
  }

  function switchMode(nextMode: EditorMode) {
    if (!editor || nextMode === mode) {
      return;
    }

    if (nextMode === 'markdown') {
      setMarkdownSource(editor.getMarkdown());
    } else {
      editor.commands.setContent(markdownSource, { contentType: 'markdown' });
    }

    setMode(nextMode);
  }

  function updateMarkdown(value: string) {
    setMarkdownSource(value);

    if (!editor) {
      return;
    }

    const document = editor.markdown?.parse(value);
    if (document?.type === 'doc') {
      onChange(document as TiptapDocument);
    }
  }

  if (!editor) {
    return <div className="min-h-64 border border-rule bg-paper dark:border-night-rule dark:bg-night" />;
  }

  return (
    <div>
      <div className="mb-2 inline-flex border border-rule dark:border-night-rule" role="group" aria-label="正文编辑模式">
        {([
          ['rich-text', '富文本'],
          ['markdown', 'Markdown'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
            className={`px-3 py-1.5 text-xs transition-colors ${
              mode === value
                ? 'bg-rust text-paper dark:bg-rust-soft dark:text-night'
                : 'text-ink-soft hover:text-rust dark:text-cream-soft dark:hover:text-rust-soft'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'rich-text' ? (
        <>
          <EditorContent
            editor={editor}
            className="rich-text-editor min-h-64 border border-b-0 border-rule bg-paper dark:border-night-rule dark:bg-night"
          />

          <div
            className="flex flex-wrap items-center gap-1 border border-t-0 border-rule bg-paper-soft p-2 dark:border-night-rule dark:bg-night-soft"
            role="toolbar"
            aria-label="正文格式工具栏"
          >
        <ToolbarButton label="H1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolbarButton label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton label="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="mx-1 h-6 w-px bg-rule dark:bg-night-rule" aria-hidden="true" />
        <ToolbarButton label="B" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton label="I" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="S" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolbarButton label="`" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />
        <span className="mx-1 h-6 w-px bg-rule dark:bg-night-rule" aria-hidden="true" />
        <ToolbarButton label="❝" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton label="•列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="1.列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton label="代码块" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <span className="mx-1 h-6 w-px bg-rule dark:bg-night-rule" aria-hidden="true" />
        <ToolbarButton label="链接" active={editor.isActive('link')} onClick={setLink} />
        <ToolbarButton label={status === 'uploading' ? '上传中…' : '图片'} disabled={status === 'uploading'} onClick={() => fileInputRef.current?.click()} />
          </div>
        </>
      ) : (
        <div>
          <textarea
            aria-label="Markdown 正文"
            value={markdownSource}
            onChange={(event) => updateMarkdown(event.target.value)}
            spellCheck={false}
            className="min-h-80 w-full resize-y border border-rule bg-paper p-4 font-mono text-sm leading-7 text-ink outline-none focus:border-rust dark:border-night-rule dark:bg-night dark:text-cream dark:focus:border-rust-soft"
            placeholder="# 从这里开始写作……"
          />
          <p className="mt-1 text-xs text-ink-soft dark:text-cream-soft">
            支持标题、粗体、斜体、引用、链接、列表、代码块与图片语法；内容仍以结构化正文安全保存。
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="上传图片"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadFile(file);
          }
          event.target.value = '';
        }}
      />

      {status === 'upload-error' ? (
        <p className="mt-1 text-xs text-rust dark:text-rust-soft" role="alert">
          上传失败：仅支持 JPEG / PNG / WebP / AVIF，且不超过 5 MiB。
        </p>
      ) : null}
    </div>
  );
}
