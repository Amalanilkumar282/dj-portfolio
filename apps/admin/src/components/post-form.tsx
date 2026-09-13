'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../lib/auth-context';
import { previewUrl } from '../lib/preview';

import { RichTextEditor } from './rich-text-editor';

interface PostDetail {
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string | null;
  content: unknown;
}

export function PostForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [slug, setSlug] = useState<string | null>(null);
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<PostDetail>(`admin/posts/${id}`)
      .then((post) => {
        setTitle(post.title);
        setExcerpt(post.excerpt ?? '');
        setAuthorName(post.authorName ?? '');
        setSlug(post.slug);
        setContent(post.content);
      })
      .catch(() => {
        setError('Could not load this post.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        title,
        excerpt: excerpt || undefined,
        authorName: authorName || undefined,
        content,
      };
      if (id) {
        await request(`admin/posts/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/posts', { method: 'POST', body });
      }
      router.push('/posts');
    } catch {
      setError('Could not save this post. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/blog/${slug}`) : null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit post' : 'New post'}</h1>
        {preview ? (
          <a href={preview} target="_blank" rel="noopener noreferrer" className="text-accent text-sm underline">
            Preview live →
          </a>
        ) : null}
      </div>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="mt-6 space-y-4"
      >
        <div>
          <label htmlFor="title" className="text-fg-strong text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="excerpt" className="text-fg-strong text-sm font-medium">
            Excerpt
          </label>
          <textarea
            id="excerpt"
            rows={2}
            value={excerpt}
            onChange={(event) => {
              setExcerpt(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="authorName" className="text-fg-strong text-sm font-medium">
            Author name
          </label>
          <input
            id="authorName"
            value={authorName}
            onChange={(event) => {
              setAuthorName(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <span className="text-fg-strong text-sm font-medium">Content</span>
          <div className="mt-1">
            <RichTextEditor content={content} onChange={setContent} />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-on-accent rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create post'}
        </button>
      </form>
    </div>
  );
}
