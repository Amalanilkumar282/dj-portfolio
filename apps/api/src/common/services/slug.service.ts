import { ConflictException, Injectable } from '@nestjs/common';

import { slugify, uniqueSlug } from '@dj/utils';

import { ERROR_CODES } from '../problems';

/** Checks whether a slug is already taken, excluding an optional row. */
export type SlugTakenCheck = (candidate: string, exceptId?: string) => Promise<boolean>;

/**
 * Slug generation and collision handling.
 *
 * Slugs are the public identity of every content entity, so two rules apply:
 *
 * 1. **Never silently change a slug the caller supplied.** If an editor typed
 *    a slug and it is taken, that is a 409 they need to see — quietly saving
 *    `bolly-tech-2` would leave them with a URL they did not choose and did
 *    not notice.
 * 2. **Always derive a unique one when none was supplied.** Auto-generating
 *    from a title is a convenience, so appending a discriminator there is the
 *    expected behaviour rather than a surprise.
 *
 * Generation itself lives in `@dj/utils` so the seeds and any future importer
 * produce byte-identical slugs.
 */
@Injectable()
export class SlugService {
  /**
   * Resolves the slug to persist.
   *
   * @param supplied  What the caller sent, if anything.
   * @param source    Fallback to derive from — usually the title or name.
   * @param isTaken   Uniqueness check against the relevant table.
   * @param exceptId  Row being updated, so it does not collide with itself.
   */
  async resolve(
    supplied: string | undefined | null,
    source: string,
    isTaken: SlugTakenCheck,
    exceptId?: string,
  ): Promise<string> {
    if (supplied) {
      // Normalised even when supplied: an editor pasting "Bolly Tech" should
      // get `bolly-tech` rather than a slug with a space in it.
      const normalised = slugify(supplied);

      if (await isTaken(normalised, exceptId)) {
        throw new ConflictException({
          message: `The slug "${normalised}" is already in use.`,
          code: ERROR_CODES.SLUG_TAKEN,
          errors: [{ pointer: '/slug', code: 'unique', message: 'Already in use.' }],
        });
      }

      return normalised;
    }

    return uniqueSlug(source, (candidate) => isTaken(candidate, exceptId));
  }
}
