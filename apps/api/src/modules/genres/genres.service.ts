import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  ContentChangedEvent,
  GenreAdminDetail,
  GenreCreateInput,
  GenreDetail,
  GenreUpdateInput,
} from '@dj/contracts';
import { AuditAction } from '@dj/db';

import type { DomainEventBus } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { CONTENT_CHANGED } from '../../infra/revalidation/revalidation.service';
import { AuditService } from '../audit/audit.service';

import { toGenreAdminDetail, toGenreDetail } from './genres.mapper';
import { GenresRepository } from './genres.repository';

/** The scalar columns a create or update may set. */
interface GenreScalarWrite {
  slug?: string;
  name?: string;
  description?: string | null;
  colorHex?: string | null;
  sortIndex?: number;
}

/**
 * Genre business rules.
 *
 * **Deliberately does not extend `BaseContentService`.** A genre is taxonomy,
 * not publishable content: no `status`, no `publishedAt`, no `deletedAt`. It
 * would inherit `publish`, `unpublish`, `archive`, `schedule` and `restore`,
 * none of which have a column to write to — an abstraction that fits in the
 * type system but not in the database.
 *
 * What it *does* keep is the base class's mutation ordering, which is the part
 * that matters: **write → audit → emit `content.changed`**, in that order.
 * Emitting before the write races the web app into re-reading the old row;
 * skipping the emit leaves the site serving a stale genre label until the
 * weekly backstop cron.
 *
 * See docs/02-architecture/backend.md §"Adding a content module".
 */
@Injectable()
export class GenresService {
  private readonly entityName = 'genre' as const;
  private readonly auditEntityType = 'Genre';

  constructor(
    private readonly repository: GenresRepository,
    private readonly audit: AuditService,
    // Injected by token, not by class: `EventEmitter2`'s declaration is
    // broken upstream and resolves as `any`, which would silently disable
    // type checking on every emit below. See common/events.ts.
    @Inject(DOMAIN_EVENT_BUS) private readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
  ) {}

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    q?: string | undefined;
    inUse?: boolean | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: GenreDetail[]; nextCursor: string | null; hasMore: boolean }> {
    // Decoded here, not in the repository: a malformed cursor is a request
    // validation failure and `decode` raises the 400 for it. Skipping this is
    // silent — the endpoint keeps returning a `nextCursor` that does nothing.
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.list({
      q: query.q,
      inUse: query.inUse,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      // One extra row, so `hasMore` needs no separate count().
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toGenreDetail),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string): Promise<GenreDetail> {
    const row = await this.repository.findBySlug(slug);

    if (!row) {
      throw new NotFoundException({
        message: `No genre exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toGenreDetail(row);
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listSlugs();
  }

  // ── admin ────────────────────────────────────────────────────────────────

  async listAdmin(query: {
    q?: string | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: GenreAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toGenreAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<GenreAdminDetail> {
    return toGenreAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: GenreCreateInput): Promise<GenreAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.name, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    await this.assertNameFree(input.name);

    const created = await this.repository.create({
      ...this.toWriteData(input),
      slug,
      name: input.name,
    });

    await this.afterMutation(created.id, created.slug, AuditAction.CREATE, 'create');

    return toGenreAdminDetail(created);
  }

  async update(id: string, input: GenreUpdateInput): Promise<GenreAdminDetail> {
    const current = await this.loadForAdmin(id);

    const slug =
      input.slug === undefined
        ? undefined
        : await this.slugs.resolve(
            input.slug,
            input.name ?? current.name,
            (candidate, exceptId) => this.repository.isSlugTaken(candidate, exceptId),
            id,
          );

    if (input.name !== undefined && input.name !== current.name) {
      await this.assertNameFree(input.name, id);
    }

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input),
      ...(slug === undefined ? {} : { slug }),
      ...(input.name === undefined ? {} : { name: input.name }),
    });

    await this.afterMutation(updated.id, updated.slug, AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
      // The old slug is recorded so the revalidation of the *previous* tag is
      // traceable after the fact; the tag itself is emitted below.
      ...(slug !== undefined && slug !== current.slug ? { previousSlug: current.slug } : {}),
    });

    // A slug change orphans the old tag, so the old one is invalidated too —
    // otherwise a page fetched under `genre:psy-trance` keeps its stale copy
    // forever, because nothing will ever name that tag again.
    if (slug !== undefined && slug !== current.slug) {
      this.emitChange(updated.id, current.slug, 'update');
    }

    return toGenreAdminDetail(updated);
  }

  /**
   * Deletes a genre, but **refuses if anything still uses it**.
   *
   * This guard is the reason the method exists at all. `Genre` has no
   * `deletedAt`, so the delete is real; and `PersonaGenre` / `TrackGenre`
   * both declare `onDelete: Cascade`, so Postgres does not reject it — it
   * quietly removes the tag from every persona and track that carried it.
   * There is no undo, and nothing in the response would have hinted that 40
   * tracks just lost a genre.
   *
   * So: 409 listing what is in the way, mirroring the `MEDIA_IN_USE` pattern.
   * Re-tagging the content first is a deliberate act; losing the tags as a
   * side effect of a delete is not.
   */
  async remove(id: string): Promise<void> {
    await this.loadForAdmin(id);

    const counts = await this.repository.countReferences(id);
    const total = counts.personas + counts.tracks;

    if (total > 0) {
      throw new ConflictException({
        message:
          `This genre is still used by ${String(counts.personas)} persona(s) and ` +
          `${String(counts.tracks)} track(s). Re-tag them first — deleting it would ` +
          `remove the genre from all of them.`,
        code: ERROR_CODES.GENRE_IN_USE,
        errors: (await this.repository.listReferences(id)).map((reference) => ({
          pointer: '/id',
          code: 'in_use',
          message: `${reference.entity}: ${reference.title}`,
        })),
      });
    }

    const genre = await this.loadForAdmin(id);
    await this.repository.hardDelete(id);

    await this.afterMutation(id, genre.slug, AuditAction.DELETE, 'delete', {
      hardDeleted: true,
      name: genre.name,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.repository.reorder(entries);

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: this.auditEntityType,
      metadata: { reordered: entries.length },
    });

    // No slug: a reorder affects the list, not one entity.
    this.events.emit(CONTENT_CHANGED, {
      entity: this.entityName,
      id: 'reorder',
      action: 'update',
    } satisfies ContentChangedEvent);
  }

  // ── internals ────────────────────────────────────────────────────────────

  /**
   * `name` is `@unique`, so a collision must be caught here.
   *
   * Left to Prisma it surfaces as a P2002 pointing at `name` from a request
   * where the caller only edited the slug, which reads like a bug in the API.
   */
  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    if (await this.repository.isNameTaken(name, exceptId)) {
      throw new ConflictException({
        message: `A genre named "${name}" already exists.`,
        code: ERROR_CODES.UNIQUE_CONSTRAINT,
        errors: [{ pointer: '/name', code: 'duplicate', message: 'This name is already taken.' }],
      });
    }
  }

  /**
   * Maps contract input to Prisma data, omitting undefined.
   *
   * Built additively because with `exactOptionalPropertyTypes` an explicit
   * `undefined` is not the same as an absent key, and Prisma only treats it as
   * "leave unchanged" by accident of implementation. This makes PATCH exact: a
   * field the caller did not mention is never touched.
   */
  private toWriteData(input: GenreCreateInput | GenreUpdateInput): GenreScalarWrite {
    const data: GenreScalarWrite = {};

    if (input.description !== undefined) data.description = input.description;
    if (input.colorHex !== undefined) data.colorHex = input.colorHex;
    if (input.sortIndex !== undefined) data.sortIndex = input.sortIndex;

    return data;
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);

    if (!row) {
      throw new NotFoundException({
        message: `No genre exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }

  /** Audit then revalidate, in that order. Mirrors `BaseContentService`. */
  private async afterMutation(
    id: string,
    slug: string,
    action: AuditAction,
    changeAction: ContentChangedEvent['action'],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action,
      entityType: this.auditEntityType,
      entityId: id,
      metadata,
    });

    this.emitChange(id, slug, changeAction);
  }

  private emitChange(id: string, slug: string, action: ContentChangedEvent['action']): void {
    this.events.emit(CONTENT_CHANGED, {
      entity: this.entityName,
      id,
      slug,
      action,
    } satisfies ContentChangedEvent);
  }
}
