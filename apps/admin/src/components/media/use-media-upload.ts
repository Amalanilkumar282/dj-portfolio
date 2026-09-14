import { useState } from 'react';

import { useAuth } from '../../lib/auth-context';

export interface UploadedAsset {
  id: string;
  publicId: string;
  resourceType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'RAW';
  secureUrl: string;
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
 * The signed direct browser → Cloudinary upload, then a confirm call so the
 * API re-reads authoritative metadata rather than trusting the browser — see
 * docs/02-architecture/media-pipeline.md. Shared by the full media library
 * page and any in-form inline uploader (`InlineUploader`) so there is exactly
 * one implementation of this flow, not one per surface it's needed on.
 */
export function useMediaUpload(): {
  upload: (file: File, options: { purpose: string; entityType: string; altText?: string }) => Promise<UploadedAsset>;
  uploading: boolean;
  progress: string | null;
  error: string | null;
  setError: (error: string | null) => void;
} {
  const { request } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(
    file: File,
    options: { purpose: string; entityType: string; altText?: string },
  ): Promise<UploadedAsset> {
    setError(null);
    setUploading(true);
    try {
      const resourceType = resourceTypeFor(file);

      setProgress('Requesting a signed upload slot…');
      const signed = await request<UploadSignature>('admin/media/upload-signature', {
        method: 'POST',
        body: { purpose: options.purpose, entityType: options.entityType, resourceType },
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
      const confirmed = await request<UploadedAsset>('admin/media', {
        method: 'POST',
        body: {
          publicId: uploadResult.public_id,
          purpose: options.purpose,
          resourceType,
          altText: options.altText ?? undefined,
        },
      });

      return confirmed;
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed.';
      setError(message);
      throw uploadError;
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return { upload, uploading, progress, error, setError };
}
