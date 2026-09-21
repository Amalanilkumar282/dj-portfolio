'use client';

import { useState } from 'react';

import type { MediaAsset } from './media-library';

function nameFromPublicId(publicId: string): string {
  const lastSegment = publicId.split('/').pop() ?? publicId;
  return lastSegment;
}

export function MediaCard({
  asset,
  onDelete,
}: {
  asset: MediaAsset;
  onDelete: () => void;
}): React.JSX.Element {
  const [showPath, setShowPath] = useState(false);
  const name = nameFromPublicId(asset.publicId);

  return (
    <div className="border-border bg-surface rounded-md border p-3">
      {asset.resourceType === 'IMAGE' ? (
        // eslint-disable-next-line @next/next/no-img-element -- a raw admin thumbnail from a live Cloudinary URL, not a `MediaImage`-shaped public-site image
        <img src={asset.secureUrl} alt={asset.altText ?? ''} className="aspect-square w-full rounded object-cover" />
      ) : asset.resourceType === 'VIDEO' ? (
        <video
          src={asset.secureUrl}
          controls
          muted
          preload="metadata"
          className="aspect-square w-full rounded bg-bg object-cover"
        />
      ) : asset.resourceType === 'AUDIO' ? (
        <div className="bg-bg flex aspect-square w-full flex-col items-center justify-center gap-2 rounded p-3">
          <span className="text-xs text-fg-muted">AUDIO</span>
          <audio src={asset.secureUrl} controls preload="metadata" className="w-full" />
        </div>
      ) : (
        <div className="bg-bg flex aspect-square w-full items-center justify-center rounded text-xs text-fg-muted">
          {asset.resourceType}
        </div>
      )}

      <button
        type="button"
        title={asset.publicId}
        onMouseEnter={() => {
          setShowPath(true);
        }}
        onMouseLeave={() => {
          setShowPath(false);
        }}
        onClick={() => {
          setShowPath((current) => !current);
        }}
        className="mt-2 block w-full truncate text-left text-xs text-fg-muted"
      >
        {showPath ? asset.publicId : name}
      </button>

      <button type="button" onClick={onDelete} className="text-danger mt-1 text-xs underline">
        Delete
      </button>
    </div>
  );
}
