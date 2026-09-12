'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';

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
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
}): React.JSX.Element {
  const { request } = useAuth();
  const [assets, setAssets] = useState<MediaRow[]>([]);

  useEffect(() => {
    request<{ data: MediaRow[] }>('admin/media?perPage=100')
      .then((result) => {
        setAssets(result.data);
      })
      .catch(() => {
        setAssets([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once per mount
  }, []);

  const selected = assets.find((asset) => asset.id === value);

  return (
    <div>
      <label className="text-fg-strong text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center gap-3">
        {selected?.resourceType === 'IMAGE' ? (
          // eslint-disable-next-line @next/next/no-img-element -- a thumbnail from a live Cloudinary URL for a plain picker, not a public-site `MediaImage`
          <img src={selected.secureUrl} alt="" className="h-10 w-10 rounded object-cover" />
        ) : null}
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
      <a href="/media" target="_blank" rel="noopener noreferrer" className="text-accent mt-1 inline-block text-xs underline">
        Upload a new asset →
      </a>
    </div>
  );
}
