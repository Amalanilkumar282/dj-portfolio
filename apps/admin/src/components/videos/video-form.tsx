'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { usePersonaKeyOptions } from '../../lib/reference-data';
import { InlineUploader } from '../media/inline-uploader';
import { type UploadedAsset } from '../media/use-media-upload';

type Provider = 'YOUTUBE' | 'VIMEO' | 'CLOUDINARY';

interface MediaRow {
  id: string;
  publicId: string;
  resourceType: string;
  secureUrl: string;
}

interface EventRow {
  id: string;
  title: string;
}

interface VideoDetail {
  slug: string;
  title: string;
  description: string | null;
  provider: Provider;
  providerVideoId: string | null;
  hostedMediaId: string | null;
  thumbnailId: string | null;
  durationSec: number | null;
  personaKey: string | null;
  eventId: string | null;
  transcript: string | null;
  isFeatured: boolean;
}

const INPUT =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong';

/**
 * Bespoke rather than the generic scalar form, because a video is not a flat
 * row: which fields are required depends on the provider, and two of them are
 * media pickers.
 *
 * The provider switch is the whole reason this file exists. The API rejects a
 * YouTube video with no id and a Cloudinary video with no hosted asset — so
 * the form asks for exactly the one that applies and hides the other, rather
 * than showing both and letting the artist discover the rule from a 422.
 */
export function VideoForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState<Provider>('YOUTUBE');
  const [providerVideoId, setProviderVideoId] = useState('');
  const [hostedMediaId, setHostedMediaId] = useState('');
  const [thumbnailId, setThumbnailId] = useState('');
  const [durationSec, setDurationSec] = useState('');
  const [personaKey, setPersonaKey] = useState('');
  const [eventId, setEventId] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  const [imageOptions, setImageOptions] = useState<MediaRow[]>([]);
  const [videoOptions, setVideoOptions] = useState<MediaRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadMedia(): void {
    // perPage caps at 100 in `MediaAdminListQuery`; asking for more 422s and
    // the picker silently renders empty. The gallery form learned this the
    // hard way — same ceiling here.
    request<{ data: MediaRow[] }>('admin/media?perPage=100')
      .then((result) => {
        setImageOptions(result.data.filter((asset) => asset.resourceType === 'IMAGE'));
        setVideoOptions(result.data.filter((asset) => asset.resourceType === 'VIDEO'));
      })
      .catch(() => {
        setImageOptions([]);
        setVideoOptions([]);
      });
  }

  useEffect(() => {
    loadMedia();
    request<{ data: EventRow[] }>('admin/events?perPage=100')
      .then((result) => {
        setEvents(result.data);
      })
      .catch(() => {
        setEvents([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once per mount
  }, []);

  useEffect(() => {
    if (!id) return;
    request<VideoDetail>(`admin/videos/${id}`)
      .then((video) => {
        setTitle(video.title);
        setDescription(video.description ?? '');
        setProvider(video.provider);
        setProviderVideoId(video.providerVideoId ?? '');
        setHostedMediaId(video.hostedMediaId ?? '');
        setThumbnailId(video.thumbnailId ?? '');
        setDurationSec(video.durationSec === null ? '' : String(video.durationSec));
        setPersonaKey(video.personaKey ?? '');
        setEventId(video.eventId ?? '');
        setIsFeatured(video.isFeatured);
      })
      .catch(() => {
        setError('Could not load this video.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  function onThumbnailUploaded(asset: UploadedAsset): void {
    loadMedia();
    setThumbnailId(asset.id);
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        title,
        description: description || null,
        provider,
        // Only the field this provider actually uses is sent; the other is
        // explicitly nulled, so switching provider on an existing row does
        // not leave a stale id behind that the service would then recompose
        // an embed from.
        providerVideoId: provider === 'CLOUDINARY' ? null : providerVideoId.trim() || null,
        hostedMediaId: provider === 'CLOUDINARY' ? hostedMediaId || null : null,
        thumbnailId: thumbnailId || null,
        durationSec: durationSec ? Number(durationSec) : null,
        personaKey: personaKey || null,
        eventId: eventId || null,
        isFeatured,
      };
      if (id) {
        await request(`admin/videos/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/videos', { method: 'POST', body });
      }
      router.push('/videos');
    } catch {
      setError(
        provider === 'CLOUDINARY'
          ? 'Could not save. A Cloudinary video needs an uploaded video file.'
          : 'Could not save. Check the video id — paste just the id, not the whole URL.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit video' : 'New video'}</h1>
      <p className="text-fg-muted mt-2 text-sm">
        Published videos appear on the homepage and on /gallery. Nothing loads from YouTube or
        Vimeo until a visitor presses play, so a thumbnail is worth setting.
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
            className={INPUT}
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
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="provider" className="text-fg-strong text-sm font-medium">
            Where is it hosted?
          </label>
          <select
            id="provider"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as Provider);
            }}
            className={INPUT}
          >
            <option value="YOUTUBE">YouTube</option>
            <option value="VIMEO">Vimeo</option>
            <option value="CLOUDINARY">Uploaded here (Cloudinary)</option>
          </select>
        </div>

        {provider === 'CLOUDINARY' ? (
          <div>
            <label htmlFor="hostedMediaId" className="text-fg-strong text-sm font-medium">
              Video file
            </label>
            <select
              id="hostedMediaId"
              required
              value={hostedMediaId}
              onChange={(event) => {
                setHostedMediaId(event.target.value);
              }}
              className={INPUT}
            >
              <option value="">— choose an uploaded video —</option>
              {videoOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.publicId}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="providerVideoId" className="text-fg-strong text-sm font-medium">
              Video id
            </label>
            <input
              id="providerVideoId"
              required
              value={providerVideoId}
              onChange={(event) => {
                setProviderVideoId(event.target.value);
              }}
              placeholder={provider === 'YOUTUBE' ? 'dQw4w9WgXcQ' : '76979871'}
              className={INPUT}
            />
            <p className="text-fg-muted mt-1 text-xs">
              {provider === 'YOUTUBE'
                ? 'Just the id — the part after "v=" in the YouTube URL, or after "youtu.be/".'
                : 'Just the number at the end of the Vimeo URL.'}
            </p>
          </div>
        )}

        <div>
          <label htmlFor="thumbnailId" className="text-fg-strong text-sm font-medium">
            Thumbnail
          </label>
          <select
            id="thumbnailId"
            value={thumbnailId}
            onChange={(event) => {
              setThumbnailId(event.target.value);
            }}
            className={INPUT}
          >
            <option value="">— none —</option>
            {imageOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.publicId}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <InlineUploader purpose="GALLERY" entityType="Video" onUploaded={onThumbnailUploaded} />
          </div>
        </div>

        <div>
          <label htmlFor="durationSec" className="text-fg-strong text-sm font-medium">
            Length in seconds
          </label>
          <input
            id="durationSec"
            type="number"
            min={0}
            value={durationSec}
            onChange={(event) => {
              setDurationSec(event.target.value);
            }}
            className={INPUT}
          />
          <p className="text-fg-muted mt-1 text-xs">
            Optional. Shown as a badge on the thumbnail when set.
          </p>
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
            className={INPUT}
          >
            <option value="">— none —</option>
            {personaKeyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="eventId" className="text-fg-strong text-sm font-medium">
            From which show?
          </label>
          <select
            id="eventId"
            value={eventId}
            onChange={(event) => {
              setEventId(event.target.value);
            }}
            className={INPUT}
          >
            <option value="">— not tied to a show —</option>
            {events.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(event) => {
              setIsFeatured(event.target.checked);
            }}
          />
          <span className="text-fg-strong">Feature this video</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-on-accent rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
