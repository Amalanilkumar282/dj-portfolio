'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../lib/auth-context';
import { previewUrl } from '../lib/preview';

import { RichTextEditor } from './rich-text-editor';

interface StaticPageDetail {
  title: string;
  slug: string;
  content: unknown;
}

export function StaticPageForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState<string | null>(null);
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<StaticPageDetail>(`admin/pages/${id}`)
      .then((page) => {
        setTitle(page.title);
        setSlug(page.slug);
        setContent(page.content);
      })
      .catch(() => {
        setError('Could not load this page.');
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
      const body = { title, content };
      if (id) {
        await request(`admin/pages/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/pages', { method: 'POST', body });
      }
      router.push('/pages');
    } catch {
      setError('Could not save this page. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  // Only correct for the three legal pages apps/web actually renders by slug
  // today (privacy/terms/cookies) — there is no generic `/[slug]` static
  // page route yet. Still useful for those three; wrong for anything else.
  const preview = slug ? previewUrl(`/${slug}`) : null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit page' : 'New page'}</h1>
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
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create page'}
        </button>
      </form>
    </div>
  );
}
