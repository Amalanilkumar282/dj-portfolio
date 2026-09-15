'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';

import { InlineUploader } from './inline-uploader';
import { type UploadedAsset } from './use-media-upload';

interface MediaRow {
  id: string;
  publicId: string;
  resourceType: string;
  secureUrl: string;
}

/**
 * Picks an already-uploaded media asset by id — a dropdown over the
 * library, not an in-form uploader. Upload happens once, on `/media`; this
 * is the "attach it here" half of the flow. No crop/focal-point UI (see
 * STATUS.md's Group E "next pass" section) — this picker is scoped to
 * exactly what it needs to do: choose an id.
 */
export function MediaSelect({
  label,
  value,
  onChange,
  hint,
  mediaType = 'IMAGE',
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  /**
   * One line saying exactly where this field shows up on the public site —
   * "Where will my change show up?" is the single most common question a
   * non-technical editor asks of any CMS field, and the honest answer is
   * usually "it depends what kind of field this is" unless the field itself
   * says so.
   */
  hint?: string;
  /** Restricts the dropdown to one Cloudinary resource type. Most fields on
   * this site are images; a hero background clip is the video case, and a
   * self-hosted track file is the audio case. */
  mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO';
}): React.JSX.Element {
  const { request } = useAuth();
  const [assets, setAssets] = useState<MediaRow[]>([]);

  const load = useCallback(() => {
    request<{ data: MediaRow[] }>('admin/media?perPage=100')
      .then((result) => {
        setAssets(result.data.filter((asset) => asset.resourceType === mediaType));
      })
      .catch(() => {
        setAssets([]);
      });
  }, [request, mediaType]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = assets.find((asset) => asset.id === value);

  function onUploaded(asset: UploadedAsset): void {
    load();
    onChange(asset.id);
  }

  return (
    <div>
      <label className="text-fg-strong text-sm font-medium">{label}</label>
      {hint ? <p className="text-fg-muted mt-0.5 text-xs">{hint}</p> : null}
      <div className="mt-1 flex items-center gap-3">
        {selected?.resourceType === 'IMAGE' ? (
          // eslint-disable-next-line @next/next/no-img-element -- a thumbnail from a live Cloudinary URL for a plain picker, not a public-site `MediaImage`
          <img src={selected.secureUrl} alt="" className="h-10 w-10 rounded object-cover" />
        ) : selected?.resourceType === 'VIDEO' ? (
          <div className="bg-surface-raised text-fg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border text-lg">
            ▶
          </div>
        ) : selected?.resourceType === 'AUDIO' ? (
          <div className="bg-surface-raised text-fg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border text-lg">
            ♪
          </div>
        ) : (
          // The empty state: nothing selected does not mean nothing to see
          // here — it means the public site currently falls back to a
          // generated colour field in this slot (see the `ShaderField`/
          // gradient backdrop that runs behind every hero). Saying so here
          // prevents "why is my page blank" support questions.
          <div className="text-fg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-border text-[10px] leading-tight">
            none
          </div>
        )}
        <select
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
        >
          <option value="">— none —</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.publicId}
            </option>
          ))}
        </select>
      </div>
      <InlineUploader
        purpose={mediaType === 'VIDEO' ? 'BACKGROUND_VIDEO' : mediaType === 'AUDIO' ? 'DOCUMENT' : 'GALLERY'}
        entityType="misc"
        onUploaded={onUploaded}
      />
    </div>
  );
}
