'use client';

import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

/**
 * Plain Tiptap — `StarterKit` + `Link`, no custom embed nodes
 * (`TrackEmbed`/`PlaylistEmbed`/`EventEmbed`/`GalleryEmbed`/`Callout` from
 * the masterplan). Every node/mark it can produce (bold, italic, code,
 * link, headings, lists, blockquote, code block) is already handled by
 * `apps/web`'s `RichText` renderer, so content written here round-trips
 * correctly on the public site today — the custom nodes are additive, not
 * a blocker for using this editor now.
 */
export function RichTextEditor({
  content,
  onChange,
}: {
  content: unknown;
  onChange: (json: unknown) => void;
}): React.JSX.Element | null {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: content ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm min-h-[240px] max-w-none rounded-md border border-border bg-surface px-3 py-2 text-fg-strong focus:outline-none',
      },
    },
  });

  // The record loads asynchronously (a separate fetch from the editor's own
  // mount), so the initial `content` prop is often stale by the time it
  // arrives — push it in explicitly once it does.
  useEffect(() => {
    if (editor && content) {
      const current = JSON.stringify(editor.getJSON());
      const next = JSON.stringify(content);
      if (current !== next) editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div>
      <div className="border-border bg-bg mb-2 flex flex-wrap gap-1 rounded-md border p-1 text-xs">
        {(
          [
            ['Bold', () => editor.chain().focus().toggleBold().run()],
            ['Italic', () => editor.chain().focus().toggleItalic().run()],
            ['Code', () => editor.chain().focus().toggleCode().run()],
            ['H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
            ['H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run()],
            ['• List', () => editor.chain().focus().toggleBulletList().run()],
            ['1. List', () => editor.chain().focus().toggleOrderedList().run()],
            ['Quote', () => editor.chain().focus().toggleBlockquote().run()],
            ['Code block', () => editor.chain().focus().toggleCodeBlock().run()],
          ] as const
        ).map(([label, action]) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="rounded px-2 py-1 text-fg-secondary hover:bg-surface hover:text-fg-strong"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('Link URL');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className="rounded px-2 py-1 text-fg-secondary hover:bg-surface hover:text-fg-strong"
        >
          Link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
