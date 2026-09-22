import { BadRequestException } from '@nestjs/common';

import { ERROR_CODES } from '../../common/problems';

/**
 * Composing the embed URL server-side, from a provider plus a bare video id,
 * rather than storing whatever URL the admin pasted.
 *
 * The public page hands this straight to an `<iframe src>`. If the value were
 * free text, every renderer would have to re-decide whether it was safe, and
 * one that forgot would be an injection point. Composing it here means an
 * unsafe value cannot be stored in the first place — the same reasoning
 * `Track.embedHtml`'s allowlist already applies to pasted markup.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function composeEmbedUrl(
  provider: 'YOUTUBE' | 'VIMEO' | 'CLOUDINARY',
  providerVideoId: string | null,
): string | null {
  if (provider === 'CLOUDINARY' || !providerVideoId) return null;

  if (!ID_PATTERN.test(providerVideoId)) {
    throw new BadRequestException({
      message:
        'Enter the video id on its own (the part after "v=" or the last path segment), not a full URL.',
      code: ERROR_CODES.VALIDATION_FAILED,
    });
  }

  // `youtube-nocookie` rather than `youtube`: no tracking cookie is set until
  // the viewer actually presses play, which is what lets the rail render
  // without a consent prompt.
  return provider === 'YOUTUBE'
    ? `https://www.youtube-nocookie.com/embed/${providerVideoId}`
    : `https://player.vimeo.com/video/${providerVideoId}`;
}
