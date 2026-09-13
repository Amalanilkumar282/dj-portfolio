import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { TagAdminDetail, TagCreateInput, TagDetail, TagUpdateInput } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import { ERROR_CODES } from '../../common/problems';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';

import { toTagAdminDetail, toTagDetail } from './tags.mapper';
import { TagsRepository } from './tags.repository';

/** Taxonomy, like `GenresService`: no publish workflow, guarded hard delete. */
@Injectable()
export class TagsService {
  constructor(
    private readonly repository: TagsRepository,
    private readonly audit: AuditService,
    private readonly slugs: SlugService,
  ) {}

  async listPublic(query: { q?: string | undefined; limit: number }): Promise<TagDetail[]> {
    const rows = await this.repository.list({ q: query.q, take: query.limit });
    return rows.map(toTagDetail);
  }

  async findPublicBySlug(slug: string): Promise<TagDetail> {
    const row = await this.repository.findBySlug(slug);
    if (!row) {
      throw new NotFoundException({ message: `No tag exists at "${slug}".`, code: ERROR_CODES.NOT_FOUND });
    }
    return toTagDetail(row);
  }

  async listAdmin(query: { q?: string | undefined; limit: number }): Promise<TagAdminDetail[]> {
    const rows = await this.repository.list({ q: query.q, take: query.limit });
    return rows.map(toTagAdminDetail);
  }

  async create(input: TagCreateInput): Promise<TagAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.name, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    await this.assertNameFree(input.name);

    const created = await this.repository.create({
      slug,
      name: input.name,
      description: input.description ?? null,
    });

    await this.audit.record({ action: AuditAction.CREATE, entityType: 'Tag', entityId: created.id });

    return toTagAdminDetail(created);
  }

  async update(id: string, input: TagUpdateInput): Promise<TagAdminDetail> {
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
      ...(slug === undefined ? {} : { slug }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
    });

    await this.audit.record({ action: AuditAction.UPDATE, entityType: 'Tag', entityId: id });

    return toTagAdminDetail(updated);
  }

  async remove(id: string): Promise<void> {
    const tag = await this.loadForAdmin(id);

    const postCount = await this.repository.countPosts(id);
    if (postCount > 0) {
      throw new ConflictException({
        message: `This tag is still used by ${String(postCount)} post(s). Re-tag them first.`,
        code: ERROR_CODES.GENRE_IN_USE,
      });
    }

    await this.repository.hardDelete(id);

    await this.audit.record({
      action: AuditAction.DELETE,
      entityType: 'Tag',
      entityId: id,
      metadata: { hardDeleted: true, name: tag.name },
    });
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    if (await this.repository.isNameTaken(name, exceptId)) {
      throw new ConflictException({
        message: `A tag named "${name}" already exists.`,
        code: ERROR_CODES.UNIQUE_CONSTRAINT,
      });
    }
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);
    if (!row) {
      throw new NotFoundException({ message: `No tag exists with id "${id}".`, code: ERROR_CODES.NOT_FOUND });
    }
    return row;
  }
}
