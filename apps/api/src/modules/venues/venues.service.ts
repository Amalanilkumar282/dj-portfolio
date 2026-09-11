import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  VenueAdminDetail,
  VenueCreateInput,
  VenueDetail,
  VenueSummary,
  VenueUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';

import { toVenueAdminDetail, toVenueDetail, toVenueSummary } from './venues.mapper';
import { VenuesRepository } from './venues.repository';

/**
 * The scalar columns a create or update may set.
 *
 * Declared explicitly rather than reusing a Prisma input type: `CreateInput`
 * and `UpdateInput` are structurally different (Update wraps every field in
 * `FieldUpdateOperationsInput`), so no single Prisma type is assignable to
 * both.
 */
interface VenueScalarWrite {
  slug?: string;
  name?: string;
  city?: string;
  state?: string | null;
  country?: string;
  addressLine?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  capacity?: number | null;
  notes?: string | null;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

/** The row shape BaseContentService needs. */
interface VenueRowBase extends PublishableRow {
  slug: string;
}

@Injectable()
export class VenuesService extends BaseContentService<VenueRowBase> {
  protected readonly entityName = 'venue' as const;
  protected readonly auditEntityType = 'Venue';

  constructor(
    protected readonly repository: VenuesRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
  ) {
    super();
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    city?: string | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: VenueSummary[]; nextCursor: string | null; hasMore: boolean }> {
    // Decoded here, not in the repository: a malformed cursor is a request
    // validation failure, and `decode` raises the 400 for it. Skipping this
    // step is silent — the endpoint keeps returning a `nextCursor` that has
    // no effect, so a client paginates the first page forever.
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      city: query.city,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      // One extra row, so `hasMore` needs no separate count().
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toVenueSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<VenueDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);

    if (!row) {
      throw new NotFoundException({
        message: `No published venue exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toVenueDetail(row);
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedSlugs();
  }

  // ── admin ────────────────────────────────────────────────────────────────

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: VenueAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toVenueAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<VenueAdminDetail> {
    return toVenueAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: VenueCreateInput, now: Date): Promise<VenueAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.name, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    await this.assertNameCityFree(input.name, input.city);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      name: input.name,
      city: input.city,
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toVenueAdminDetail(created);
  }

  async update(id: string, input: VenueUpdateInput, now: Date): Promise<VenueAdminDetail> {
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

    const nextName = input.name ?? current.name;
    const nextCity = input.city ?? current.city;
    if (
      (input.name !== undefined || input.city !== undefined) &&
      (nextName !== current.name || nextCity !== current.city)
    ) {
      await this.assertNameCityFree(nextName, nextCity, id);
    }

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.city === undefined ? {} : { city: input.city }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toVenueAdminDetail(updated);
  }

  /**
   * Maps contract input to Prisma data, omitting undefined.
   *
   * Omission matters: with `exactOptionalPropertyTypes`, passing `undefined`
   * explicitly is different from not passing the key, and Prisma only
   * treats an explicit `undefined` as "leave unchanged" by accident of
   * implementation. Building the object additively makes PATCH semantics
   * exact — a field the caller did not mention is never touched.
   */
  private toWriteData(input: VenueCreateInput | VenueUpdateInput, now: Date): VenueScalarWrite {
    const data: VenueScalarWrite = {};

    const assign = (key: keyof typeof input, target: string = key): void => {
      const value = input[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[target] = value;
      }
    };

    assign('state');
    assign('country');
    assign('addressLine');
    assign('postalCode');
    assign('latitude');
    assign('longitude');
    assign('websiteUrl');
    assign('instagramUrl');
    assign('capacity');
    assign('notes');
    assign('sortIndex');
    assign('scheduledAt');

    // Publishing through create/update stamps publishedAt here, because the
    // *_published_has_date CHECK constraint rejects a PUBLISHED row without
    // one (see prisma/sql/post-migrate.sql and ADR 0019 — Venue was missing
    // this constraint until it was added alongside this module).
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === ContentStatus.PUBLISHED) {
        data.publishedAt = now;
      }
    }

    return data;
  }

  /**
   * `@@unique([name, city])` is checked proactively so the 409 names the
   * fields the caller actually edited. Left to Postgres, a duplicate arrives
   * as a P2002 against a composite key with no obvious mapping back to
   * `/name` or `/city`.
   */
  private async assertNameCityFree(name: string, city: string, exceptId?: string): Promise<void> {
    if (await this.repository.isNameCityTaken(name, city, exceptId)) {
      throw new ConflictException({
        message: `A venue named "${name}" already exists in ${city}.`,
        code: ERROR_CODES.UNIQUE_CONSTRAINT,
        errors: [
          {
            pointer: '/name',
            code: 'duplicate',
            message: 'This venue already exists in this city.',
          },
        ],
      });
    }
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);

    if (!row) {
      throw new NotFoundException({
        message: `No venue exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }
}
