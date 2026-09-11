/**
 * Renders Tiptap JSON as React elements.
 *
 * `Post.content`/`StaticPage.content` are stored as Tiptap JSON, never HTML
 * — this is the typed `RichText` component the architecture calls for, so
 * injected markup can never reach the DOM (there is no `dangerouslySetInnerHTML`
 * here at all). Covers the node/mark set the admin's editor is expected to
 * produce; unknown node types are skipped rather than crashing the page.
 */

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: TiptapMark[];
  content?: TiptapNode[];
}

function renderMarks(text: string, marks: TiptapMark[] | undefined, key: string): React.ReactNode {
  if (!marks || marks.length === 0) return text;

  return marks.reduce<React.ReactNode>((node, mark, index) => {
    const markKey = `${key}-${String(index)}`;
    switch (mark.type) {
      case 'bold':
        return <strong key={markKey}>{node}</strong>;
      case 'italic':
        return <em key={markKey}>{node}</em>;
      case 'code':
        return <code key={markKey}>{node}</code>;
      case 'link': {
        const href = mark.attrs?.href;
        // A link mark with no href is malformed input, not a "#" placeholder
        // link — render the text plainly rather than an unnavigable anchor.
        if (typeof href !== 'string' || href.length === 0) return node;
        return (
          <a key={markKey} href={href} rel="noopener noreferrer" className="text-accent underline">
            {node}
          </a>
        );
      }
      default:
        return node;
    }
  }, text);
}

function renderNode(node: TiptapNode, key: string): React.ReactNode {
  const children = node.content?.map((child, index) => renderNode(child, `${key}-${String(index)}`));

  switch (node.type) {
    case 'doc':
      return <>{children}</>;
    case 'paragraph':
      return (
        <p key={key} className="text-fg-secondary">
          {children}
        </p>
      );
    case 'heading': {
      const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 2;
      const Tag = `h${String(Math.min(Math.max(level, 2), 4))}` as 'h2' | 'h3' | 'h4';
      return (
        <Tag key={key} className="font-display text-h4 text-fg-strong">
          {children}
        </Tag>
      );
    }
    case 'bulletList':
      return (
        <ul key={key} className="list-inside list-disc text-fg-secondary">
          {children}
        </ul>
      );
    case 'orderedList':
      return (
        <ol key={key} className="list-inside list-decimal text-fg-secondary">
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return (
        <blockquote key={key} className="border-border border-l-2 pl-4 italic text-fg-muted">
          {children}
        </blockquote>
      );
    case 'codeBlock':
      return (
        <pre key={key} className="overflow-x-auto rounded-md bg-surface p-4 text-sm">
          <code>{children}</code>
        </pre>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'text':
      return <span key={key}>{renderMarks(node.text ?? '', node.marks, key)}</span>;
    default:
      return children ? <div key={key}>{children}</div> : null;
  }
}

export function RichText({ content }: { content: unknown }): React.JSX.Element | null {
  if (!content || typeof content !== 'object') return null;
  return <div className="space-y-4">{renderNode(content as TiptapNode, 'root')}</div>;
}
