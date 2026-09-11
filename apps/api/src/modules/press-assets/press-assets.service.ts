import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  PressAssetAdminDetail,
  PressAssetCreateInput,
  PressAssetDetail,
  PressAssetDownloadInput,
  PressAssetUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { CloudinaryService } from '../../infra/cloudinary/cloudinary.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toPressAssetAdminDetail, toPressAssetDetail } from './press-assets.mapper';
import { PressAssetsRepository } from './press-assets.repository';

const DOWNLOAD_URL_TTL_DAYS = 7;

interface PressAssetScalarWrite {
  title?: string;
  description?: string | null;
  mediaId?: string | null;
  requiresEmail?: boolean;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface PressAssetRowBase extends PublishableRow {
  persona?: { slug: string } | null;
}

@Injectable()
export class PressAssetsService extends BaseContentService<PressAssetRowBase> {
  protected readonly entityName = 'pressAsset' as const;
  protected readonly auditEntityType = 'PressAsset';

  constructor(
    protected readonly repository: PressAssetsRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
    private readonly cloudinary: CloudinaryService,
  ) {
    super();
  }

  protected override personaSlugOf(row: PressAssetRowBase): string | undefined {
    return row.persona?.slug;
  }

  async listPublic(query: {
    kind?: string | undefined;
    personaSlug?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: PressAssetDetail[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      kind: query.kind,
      personaSlug: query.personaSlug,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toPressAssetDetail),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async listAdmin(query: {
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: PressAssetAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toPressAssetAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<PressAssetAdminDetail> {
    return toPressAssetAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: PressAssetCreateInput, now: Date): Promise<PressAssetAdminDetail> {
    const personaId = await this.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      kind: input.kind,
      title: input.title,
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toPressAssetAdminDetail(created);
  }

  async update(id: string, input: PressAssetUpdateInput, now: Date): Promise<PressAssetAdminDetail> {
    await this.loadForAdmin(id);

    const personaId = await this.resolvePersonaId(input.personaKey);

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toPressAssetAdminDetail(updated);
  }

  /**
   * A gated download.
   *
   * `requiresEmail` assets need an email in the body — recorded via the
   * audit trail, not stored on the asset itself. The URL is signed via
   * Cloudinary's `private_download_url` with a 7-day expiry: this is a
   * real, working signed URL, but it only genuinely restricts access when
   * the underlying `MediaAsset` was uploaded with a `private`/`authenticated`
   * delivery type — the media pipeline's browser-upload flow always uses
   * `upload`, so today this enforces the *link* expiring, not the asset
   * being unreachable by its plain `secureUrl`. Tightening that is tracked
   * in STATUS.md rather than silently assumed solved.
   */
  async requestDownload(id: string, input: PressAssetDownloadInput): Promise<{ downloadUrl: string }> {
    const asset = await this.loadForAdmin(id);

    if (asset.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException({
        message: `No published press asset exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (asset.requiresEmail && !input.email) {
      throw new BadRequestException({
        message: 'An email address is required to download this asset.',
        code: ERROR_CODES.VALIDATION_FAILED,
        errors: [{ pointer: '/email', code: 'required', message: 'Required for this asset.' }],
      });
    }

    if (!asset.media) {
      throw new NotFoundException({
        message: 'This press asset has no file attached yet.',
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_URL_TTL_DAYS * 24 * 60 * 60;
    const downloadUrl = this.cloudinary.privateDownloadUrl(asset.media.publicId, asset.media.format, {
      resourceType: asset.media.resourceType.toLowerCase() as 'image' | 'video' | 'raw',
      expiresAt,
    });

    await this.repository.incrementDownloadCount(id);

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: 'PressAsset',
      entityId: id,
      metadata: { downloaded: true, email: input.email ?? null },
    });

    return { downloadUrl };
  }

  private async resolvePersonaId(
    personaKey: PressAssetCreateInput['personaKey'],
  ): Promise<string | null | undefined> {
    if (personaKey === undefined) return undefined;
    if (personaKey === null) return null;

    const persona = await this.personas.findIdByKey(personaKey);
    if (!persona) {
      throw new NotFoundException({
        message: `No persona exists for key "${personaKey}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return persona.id;
  }

  private toWriteData(
    input: PressAssetCreateInput | PressAssetUpdateInput,
    now: Date,
  ): PressAssetScalarWrite {
    const data: PressAssetScalarWrite = {};

    if (input.description !== undefined) data.description = input.description;
    if (input.mediaId !== undefined) data.mediaId = input.mediaId;
    if (input.requiresEmail !== undefined) data.requiresEmail = input.requiresEmail;
    if (input.sortIndex !== undefined) data.sortIndex = input.sortIndex;
    if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === ContentStatus.PUBLISHED) data.publishedAt = now;
    }

    return data;
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);
    if (!row) {
      throw new NotFoundException({
        message: `No press asset exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
