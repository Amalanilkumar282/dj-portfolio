'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';
import { usePersonaKeyOptions } from '../../lib/reference-data';
import { InlineUploader } from '../media/inline-uploader';
import { type UploadedAsset } from '../media/use-media-upload';

interface MediaRow {
  id: string;
  publicId: string;
  resourceType: string;
  secureUrl: string;
}

interface GalleryItemDetail {
  id: string;
  image: { publicId: string } | null;
  caption: string | null;
  isCover: boolean;
}

interface GalleryDetail {
  slug: string;
  title: string;
  description: string | null;
  personaKey: string | null;
  layout: 'MASONRY' | 'GRID' | 'CAROUSEL';
  items: GalleryItemDetail[];
}

/** The one field this form edits that isn't a plain scalar: an ordered list
 * of media items, each carrying its own caption and cover flag. */
interface DraftItem {
  mediaId: string;
  publicId: string;
  caption: string;
  isCover: boolean;
}

export function GalleryForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [personaKey, setPersonaKey] = useState('');
  const [layout, setLayout] = useState<'MASONRY' | 'GRID' | 'CAROUSEL'>('MASONRY');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [imageOptions, setImageOptions] = useState<MediaRow[]>([]);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadImages(): void {
    request<{ data: MediaRow[] }>('admin/media?perPage=200')
      .then((result) => {
        setImageOptions(result.data.filter((asset) => asset.resourceType === 'IMAGE'));
      })
      .catch(() => {
        setImageOptions([]);
      });
  }

  useEffect(() => {
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once per mount
  }, []);

  function onUploaded(asset: UploadedAsset): void {
    loadImages();
    setItems((current) =>
      current.some((item) => item.mediaId === asset.id)
        ? current
        : [...current, { mediaId: asset.id, publicId: asset.publicId, caption: '', isCover: false }],
    );
  }

  useEffect(() => {
    if (!id) return;
    request<GalleryDetail>(`admin/galleries/${id}`)
      .then((gallery) => {
        setSlug(gallery.slug);
        setTitle(gallery.title);
        setDescription(gallery.description ?? '');
        setPersonaKey(gallery.personaKey ?? '');
        setLayout(gallery.layout);
        setItems(
          gallery.items.map((item) => ({
            mediaId: item.id,
            publicId: item.image?.publicId ?? item.id,
            caption: item.caption ?? '',
            isCover: item.isCover,
          })),
        );
      })
      .catch(() => {
        setError('Could not load this gallery.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  function addImage(mediaId: string): void {
    const asset = imageOptions.find((option) => option.id === mediaId);
    if (!asset || items.some((item) => item.mediaId === mediaId)) return;
    setItems((current) => [...current, { mediaId, publicId: asset.publicId, caption: '', isCover: false }]);
  }

  function removeImage(mediaId: string): void {
    setItems((current) => current.filter((item) => item.mediaId !== mediaId));
  }

  function setCaption(mediaId: string, caption: string): void {
    setItems((current) => current.map((item) => (item.mediaId === mediaId ? { ...item, caption } : item)));
  }

  function setCover(mediaId: string): void {
    setItems((current) => current.map((item) => ({ ...item, isCover: item.mediaId === mediaId })));
  }

  function move(index: number, direction: -1 | 1): void {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (item === undefined) return current;
      next.splice(target, 0, item);
      return next;
    });
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        title,
        description: description || null,
        personaKey: personaKey || null,
        layout,
        items: items.map((item) => ({
          mediaId: item.mediaId,
          caption: item.caption || null,
          isCover: item.isCover,
        })),
      };
      if (id) {
        await request(`admin/galleries/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/galleries', { method: 'POST', body });
      }
      router.push('/galleries');
    } catch {
      setError('Could not save this gallery. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/gallery/${slug}`) : null;
  const availableImages = imageOptions.filter((option) => !items.some((item) => item.mediaId === option.id));

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit gallery' : 'New gallery'}</h1>
        {preview ? (
          <a href={preview} target="_blank" rel="noopener noreferrer" className="text-accent text-sm underline">
            Preview live →
          </a>
        ) : null}
      </div>
      <p className="text-fg-muted mt-2 text-sm">
        Shows at djfelicitous.com/gallery{slug ? `/${slug}` : ''} once published. Only published galleries
        with at least one image ever appear there.
      </p>

      {error ? <p className="text-danger mt-4 text-sm">{error}</p> : null}

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
          <label htmlFor="description" className="text-fg-strong text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="personaKey" className="text-fg-strong text-sm font-medium">
            Persona
          </label>
          <select
            id="personaKey"
            value={personaKey}
            onChange={(event) => {
              setPersonaKey(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          >
            <option value="">— none (shown on the main /gallery page) —</option>
            {personaKeyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="layout" className="text-fg-strong text-sm font-medium">
            Layout
          </label>
          <select
            id="layout"
            value={layout}
            onChange={(event) => {
              setLayout(event.target.value as typeof layout);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          >
            <option value="MASONRY">Masonry</option>
            <option value="GRID">Even grid</option>
            <option value="CAROUSEL">Carousel</option>
          </select>
        </div>

        <div>
          <span className="text-fg-strong text-sm font-medium">Images, in order ({items.length})</span>
          {items.length > 0 ? (
            <ul className="border-border bg-surface mt-1 divide-y divide-border rounded-md border">
              {items.map((item, index) => (
                <li key={item.mediaId} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="text-fg-strong min-w-0 flex-1 truncate">
                    {item.publicId}
                    {item.isCover ? <span className="text-accent ml-2 text-xs">★ cover</span> : null}
                  </span>
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    value={item.caption}
                    onChange={(event) => {
                      setCaption(item.mediaId, event.target.value);
                    }}
                    className="w-40 shrink-0 rounded border border-border bg-bg px-2 py-1 text-xs text-fg-strong"
                  />
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        move(index, -1);
                      }}
                      className="text-fg-muted text-xs underline disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => {
                        move(index, 1);
                      }}
                      className="text-fg-muted text-xs underline disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCover(item.mediaId);
                      }}
                      className="text-fg-muted text-xs underline"
                    >
                      Set cover
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeImage(item.mediaId);
                      }}
                      className="text-danger text-xs underline"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted mt-1 text-xs">No images yet — add some below.</p>
          )}
          <details className="mt-2">
            <summary className="text-accent cursor-pointer text-sm">Add images…</summary>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {availableImages.length === 0 ? (
                <p className="text-fg-muted text-xs">Every uploaded image is already in this gallery.</p>
              ) : (
                availableImages.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      addImage(asset.id);
                    }}
                    className="text-fg-secondary hover:text-fg-strong block w-full truncate text-left text-sm"
                  >
                    {asset.publicId}
                  </button>
                ))
              )}
            </div>
            <InlineUploader purpose="GALLERY" entityType="gallery" onUploaded={onUploaded} />
          </details>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-on-accent rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : id ? 'Save changes' : 'Create gallery'}
          </button>
        </div>
      </form>
    </div>
  );
}
