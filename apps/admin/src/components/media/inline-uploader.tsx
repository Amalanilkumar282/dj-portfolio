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
 *
 * Deliberately renders no `<form>` of its own: every caller (persona/track/
 * release/playlist/program/event/venue forms, the gallery form) already
 * places this inside its own entity `<form>`, and a nested `<form>` is
 * invalid HTML — a submit click on the inner one can bubble into the
 * outer form's submit handler (or, in some browsers, hit the page's own
 * native submission instead of the JS handler entirely), triggering an
 * unwanted entity save or a real page reload. A reload wipes the in-memory
 * access token and re-runs the silent-refresh bootstrap from cold, which is
 * what made this look like "clicking upload logs me out". A plain button
 * with a click handler can't trigger any of that.
 *
 * Alt text is asked for up front, and required before the Upload button
 * will submit an image: the database enforces `media_assets_image_alt_text`
 * (every image needs alt text, a real accessibility invariant — see
 * CLAUDE.md's invariants table), so an image confirmed with none was
 * failing at the database, not at Cloudinary. `MediaLibrary`'s own upload
 * form already asks for this; this picker previously did not, so there was
 * no way to successfully upload an image through it at all.
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
  const [isImage, setIsImage] = useState(false);
  const [altText, setAltText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onUploadClick(): Promise<void> {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    if (file.type.startsWith('image/') && altText.trim().length === 0) {
      setError('Alt text is required for images — describe what is in the picture.');
      return;
    }
    try {
      const trimmedAlt = altText.trim();
      const asset = await upload(file, { purpose, entityType, ...(trimmedAlt ? { altText: trimmedAlt } : {}) });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAltText('');
      setIsImage(false);
      setOpen(false);
      onUploaded(asset);
    } catch {
      // upload() already recorded the error message via setError
    }
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
    <div className="border-border bg-surface mt-2 space-y-2 rounded-md border p-3">
      <input
        ref={fileInputRef}
        type="file"
        required
        onChange={(event) => {
          setIsImage(event.target.files?.[0]?.type.startsWith('image/') ?? false);
          setError(null);
        }}
        className="w-full text-xs text-fg-strong"
      />
      {isImage ? (
        <div>
          <label htmlFor="inline-uploader-alt" className="text-fg-strong text-xs font-medium">
            Alt text
          </label>
          <input
            id="inline-uploader-alt"
            required
            value={altText}
            onChange={(event) => {
              setAltText(event.target.value);
            }}
            placeholder="Describe what is in the picture"
            className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-xs text-fg-strong"
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
      {progress ? <p className="text-fg-muted text-xs">{progress}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            void onUploadClick();
          }}
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
    </div>
  );
}
