import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type {
  PersonaAdminDetail,
  PersonaCreateInput,
  PersonaDetail,
  PersonaPageResponse,
  PersonaSummary,
  PersonaUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus, type PersonaKey } from '@dj/db';

import { BaseContentService, type PublishableRow } from '../../common/base';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { toEventSummary } from '../events/events.mapper';
import { toPlaylistSummary } from '../playlists/playlists.mapper';
import { toProgramSummary } from '../programs/programs.mapper';
import { toReleaseSummary } from '../releases/releases.mapper';
import { toTrackSummary } from '../tracks/tracks.mapper';
import { toVenueSummary } from '../venues/venues.mapper';

import { toPersonaAdminDetail, toPersonaDetail, toPersonaSummary } from './personas.mapper';
import { PersonasRepository } from './personas.repository';

/**
 * The scalar columns a create or update may set.
 *
 * Declared explicitly rather than reusing a Prisma input type: `CreateInput`
 * and `UpdateInput` are structurally different (Update wraps every field in
 * `FieldUpdateOperationsInput`), so no single Prisma type is assignable to
 * both. This interface is assignable to each of them, and doubles as
 * documentation of what a write is allowed to touch — relations are handled
 * separately, by `setGenres`.
 */
interface PersonaScalarWrite {
  slug?: string;
  stageName?: string;
  bio?: string;
  subtitle?: string | null;
  tagline?: string | null;
  shortDescription?: string | null;
  bioShort?: string | null;
  primaryGenreLabel?: string | null;
  accentColor?: string;
  accentColorSecondary?: string | null;
  gradientCss?: string | null;
  isFeatured?: boolean;
  isDuo?: boolean;
  memberNames?: string[];
  homeCity?: string | null;
  country?: string | null;
  bpmRangeLow?: number | null;
  bpmRangeHigh?: number | null;
  yearsActiveFrom?: number | null;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

/** The row shape BaseContentService needs. */
interface PersonaRowBase extends PublishableRow {
  slug: string;
}

@Injectable()
export class PersonasService extends BaseContentService<PersonaRowBase> {
  protected readonly entityName = 'persona' as const;
  protected readonly auditEntityType = 'Persona';

  constructor(
    protected readonly repository: PersonasRepository,
    protected readonly audit: AuditService,
    protected readonly events: EventEmitter2,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
  ) {
    super();
  }

  /** A persona change invalidates its own page, so report its slug. */
  protected override personaSlugOf(row: PersonaRowBase): string | undefined {
    return row.slug;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    featured?: boolean | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: PersonaSummary[]; nextCursor: string | null; hasMore: boolean }> {
    // Decoding here, not in the repository: a malformed cursor is a request
    // validation failure, and `decode` raises the 400 for it. Skipping this
    // step is silent — the endpoint keeps returning a `nextCursor` that has
    // no effect, so a client paginates the first page forever.
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      featured: query.featured,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      // One extra row, so `hasMore` needs no separate count().
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toPersonaSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<PersonaDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);

    if (!row) {
      throw new NotFoundException({
        message: `No published persona exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toPersonaDetail(row);
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedSlugs();
  }

  /**
   * The persona landing page, assembled in two queries plus the venue rollup.
   *
   * Public pages are prerendered and revalidated by tag, so this runs rarely —
   * but it runs on a cold cache for every persona, and eight round trips there
   * would be eight chances to be slow. See docs/02-architecture/backend.md.
   */
  async getPageData(slug: string, now: Date): Promise<PersonaPageResponse> {
    const result = await this.repository.findPageData(slug, now);

    if (!result) {
      throw new NotFoundException({
        message: `No published persona exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const { persona, pastEventCount, recentEvents } = result;
    const venuesPlayed = await this.repository.listVenuesPlayed(persona.id);

    return {
      persona: toPersonaDetail(persona),
      featuredTracks: persona.tracks.map(toTrackSummary),
      playlists: persona.playlists.map(toPlaylistSummary),
      upcomingEvents: persona.events.map(toEventSummary),
      recentEvents: recentEvents.map(toEventSummary),
      pastEventCount,
      programs: persona.programs.map(toProgramSummary),
      venuesPlayed: venuesPlayed.map(toVenueSummary),
      releases: persona.releases.map(toReleaseSummary),
    };
  }

  // ── admin ────────────────────────────────────────────────────────────────

  async listAdmin(query: {
    status?: ContentStatus | undefined;
    q?: string | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: PersonaAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      status: query.status,
      q: query.q,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toPersonaAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<PersonaAdminDetail> {
    return toPersonaAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: PersonaCreateInput, now: Date): Promise<PersonaAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.stageName, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      key: input.key,
      slug,
      stageName: input.stageName,
      bio: input.bio,
    });

    if (input.genreSlugs?.length) {
      await this.repository.setGenres(created.id, input.genreSlugs);
    }

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    // Re-read so the response includes the genres just attached.
    return toPersonaAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: PersonaUpdateInput, now: Date): Promise<PersonaAdminDetail> {
    const current = await this.loadForAdmin(id);

    const slug =
      input.slug === undefined
        ? undefined
        : await this.slugs.resolve(
            input.slug,
            input.stageName ?? current.stageName,
            (candidate, exceptId) => this.repository.isSlugTaken(candidate, exceptId),
            id,
          );

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.stageName === undefined ? {} : { stageName: input.stageName }),
      ...(input.bio === undefined ? {} : { bio: input.bio }),
    });

    if (input.genreSlugs) {
      await this.repository.setGenres(id, input.genreSlugs);
    }

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toPersonaAdminDetail(await this.loadForAdmin(id));
  }

  async findIdByKey(key: PersonaKey): Promise<{ id: string; slug: string } | null> {
    return this.repository.findIdByKey(key);
  }

  /**
   * Maps contract input to Prisma data, omitting undefined.
   *
   * Omission matters: with `exactOptionalPropertyTypes`, passing `undefined`
   * explicitly is a different thing from not passing the key, and Prisma
   * treats an explicit `undefined` as "leave unchanged" only by accident of
   * implementation. Building the object additively makes PATCH semantics
   * exact — a field the caller did not mention is never touched.
   */
  private toWriteData(
    input: PersonaCreateInput | PersonaUpdateInput,
    now: Date,
  ): PersonaScalarWrite {
    const data: PersonaScalarWrite = {};

    const assign = (key: keyof typeof input, target: string = key): void => {
      const value = input[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[target] = value;
      }
    };

    assign('subtitle');
    assign('tagline');
    assign('shortDescription');
    assign('bioShort');
    assign('primaryGenreLabel');
    assign('accentColor');
    assign('accentColorSecondary');
    assign('gradientCss');
    assign('isFeatured');
    assign('isDuo');
    assign('memberNames');
    assign('homeCity');
    assign('country');
    assign('bpmRangeLow');
    assign('bpmRangeHigh');
    assign('yearsActiveFrom');
    assign('sortIndex');
    assign('scheduledAt');

    // Publishing through create/update stamps publishedAt here, because the
    // *_published_has_date CHECK constraint rejects a PUBLISHED row without
    // one — see prisma/sql/post-migrate.sql.
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === ContentStatus.PUBLISHED) {
        data.publishedAt = now;
      }
    }

    return data;
  }

  /**
   * Typed wrapper over the base `requireForAdmin`, so callers get the row WITH
   * its included relations rather than the bare publishable shape.
   */
  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);

    if (!row) {
      throw new NotFoundException({
        message: `No persona exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }
}
