'use client';

import { useRef, useState } from 'react';

import { type UploadedAsset, useMediaUpload } from './use-media-upload';

/**
 * A same-tab, same-session upload trigger for use inside entity forms —
 * picks a file, uploads it via the same signed Cloudinary flow as the full
 * Media library page, and hands the confirmed asset back. Replaces the old
 * `<a href="/media" target="_blank">` link, which opened a second tab with
 * its own cold auth bootstrap (the access token lives in memory only) and
 * would bounce to /login before the user ever got to upload anything.
 */
export function InlineUploader({
  purpose,
  entityType,
  onUploaded,
}: {
  purpose: string;
  entityType: string;
  onUploaded: (asset: UploadedAsset) => void;
}): React.JSX.Element {
  const { upload, uploading, progress, error, setError } = useMediaUpload();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    const asset = await upload(file, { purpose, entityType });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpen(false);
    onUploaded(asset);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="text-accent mt-1 inline-block text-xs underline"
      >
        Upload a new asset →
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="border-border bg-surface mt-2 space-y-2 rounded-md border p-3"
    >
      <input ref={fileInputRef} type="file" required className="w-full text-xs text-fg-strong" />
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
      {progress ? <p className="text-fg-muted text-xs">{progress}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={uploading}
          className="bg-accent text-on-accent rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
          }}
          className="text-fg-muted text-xs underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
