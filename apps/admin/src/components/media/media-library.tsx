'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

interface MediaAsset {
  id: string;
  publicId: string;
  resourceType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'RAW';
  secureUrl: string;
  bytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  purpose: string;
}

interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  eager?: string | null;
  eagerAsync?: boolean | null;
}

const PURPOSES = [
  'HERO',
  'GALLERY',
  'AVATAR',
  'FLYER',
  'COVER_ART',
  'LOGO',
  'PRESS_PHOTO',
  'DOCUMENT',
  'BACKGROUND_VIDEO',
  'OG_IMAGE',
  'GEAR',
];

const ENTITY_TYPES = [
  'persona',
  'event',
  'venue',
  'track',
  'playlist',
  'release',
  'gallery',
  'video',
  'testimonial',
  'brand',
  'service',
  'gear',
  'experience',
  'post',
  'press-kit',
  'misc',
];

function resourceTypeFor(file: File): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'RAW' {
  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  if (file.type.startsWith('audio/')) return 'AUDIO';
  return 'RAW';
}

/** Cloudinary treats audio as `video` at the resource-type level — there is no separate audio endpoint. */
function cloudinaryResourcePath(resourceType: string): 'image' | 'video' | 'raw' {
  if (resourceType === 'IMAGE') return 'image';
  if (resourceType === 'VIDEO' || resourceType === 'AUDIO') return 'video';
  return 'raw';
}

/**
 * Signed direct browser → Cloudinary upload, then a confirm call so the API
 * re-reads authoritative metadata rather than trusting the browser — see
 * docs/02-architecture/media-pipeline.md. No crop UI in this pass (see
 * STATUS.md's Group E "next pass" section); focal point can be set as plain
 * numeric inputs after upload, which is honest and functional without
 * pulling in `react-easy-crop`.
 */
export function MediaLibrary(): React.JSX.Element {
  const { request } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [purpose, setPurpose] = useState('GALLERY');
  const [entityType, setEntityType] = useState('misc');
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await request<{ data: MediaAsset[] }>('admin/media?perPage=40');
      setAssets(result.data);
    } catch {
      setError('Could not load the media library.');
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const resourceType = resourceTypeFor(file);

      setProgress('Requesting a signed upload slot…');
      const signed = await request<UploadSignature>('admin/media/upload-signature', {
        method: 'POST',
        body: { purpose, entityType, resourceType },
      });

      setProgress('Uploading to Cloudinary…');
      const formData = new FormData();
      formData.set('file', file);
      formData.set('api_key', signed.apiKey);
      formData.set('timestamp', String(signed.timestamp));
      formData.set('signature', signed.signature);
      formData.set('folder', signed.folder);
      if (signed.eager) formData.set('eager', signed.eager);
      if (signed.eagerAsync) formData.set('eager_async', 'true');

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signed.cloudName}/${cloudinaryResourcePath(resourceType)}/upload`,
        { method: 'POST', body: formData },
      );
      const uploadResult = (await uploadResponse.json()) as { public_id?: string; error?: { message: string } };

      if (!uploadResponse.ok || !uploadResult.public_id) {
        throw new Error(uploadResult.error?.message ?? 'Upload to Cloudinary failed.');
      }

      setProgress('Confirming…');
      await request('admin/media', {
        method: 'POST',
        body: {
          publicId: uploadResult.public_id,
          purpose,
          resourceType,
          altText: altText || undefined,
        },
      });

      setAltText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function remove(asset: MediaAsset): Promise<void> {
    if (!window.confirm('Delete this asset? It will be recoverable from the trash for 30 days.')) return;
    try {
      await request(`admin/media/${asset.id}`, { method: 'DELETE' });
      await load();
    } catch (deleteError) {
      if (deleteError instanceof ApiError && deleteError.status === 409) {
        setError('Still referenced by published content — cannot delete.');
      } else {
        setError('Delete failed.');
      }
    }
  }

  return (
    <div>
      <h1 className="font-display text-h2 text-fg-strong">Media library</h1>

      <form
        onSubmit={(event) => {
          void onUpload(event);
        }}
        className="border-border bg-surface mt-6 max-w-lg space-y-4 rounded-md border p-5"
      >
        <div>
          <label htmlFor="file" className="text-fg-strong text-sm font-medium">
            File
          </label>
          <input
            id="file"
            ref={fileInputRef}
            type="file"
            required
            className="mt-1 w-full text-sm text-fg-strong"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="purpose" className="text-fg-strong text-sm font-medium">
              Purpose
            </label>
            <select
              id="purpose"
              value={purpose}
              onChange={(event) => {
                setPurpose(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg-strong"
            >
              {PURPOSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="entityType" className="text-fg-strong text-sm font-medium">
              Entity type
            </label>
            <select
              id="entityType"
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg-strong"
            >
              {ENTITY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="altText" className="text-fg-strong text-sm font-medium">
            Alt text
          </label>
          <input
            id="altText"
            value={altText}
            onChange={(event) => {
              setAltText(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg-strong"
          />
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}
        {progress ? <p className="text-fg-muted text-sm">{progress}</p> : null}

        <button
          type="submit"
          disabled={uploading}
          className="bg-accent text-on-accent rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {!assets ? (
          <p className="text-fg-muted text-sm">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="text-fg-muted text-sm">No media uploaded yet.</p>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="border-border bg-surface rounded-md border p-3">
              {asset.resourceType === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element -- a raw admin thumbnail from a live Cloudinary URL, not a `MediaImage`-shaped public-site image
                <img src={asset.secureUrl} alt={asset.altText ?? ''} className="aspect-square w-full rounded object-cover" />
              ) : (
                <div className="bg-bg flex aspect-square w-full items-center justify-center rounded text-xs text-fg-muted">
                  {asset.resourceType}
                </div>
              )}
              <p className="text-fg-muted mt-2 truncate text-xs">{asset.publicId}</p>
              <button
                type="button"
                onClick={() => {
                  void remove(asset);
                }}
                className="text-danger mt-1 text-xs underline"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
