import { Injectable, NotFoundException } from '@nestjs/common';

import type { PressAssetAdminDetail } from '@dj/contracts';
import { AuditAction, PressAssetKind, type PersonaKey } from '@dj/db';

import { ERROR_CODES } from '../../common/problems';
import { CloudinaryService } from '../../infra/cloudinary/cloudinary.service';
import { renderEpkPdf } from '../../infra/press-kit/epk-pdf.template';
import { AuditService } from '../audit/audit.service';
import { MediaService } from '../media/media.service';
import { PersonasService } from '../personas/personas.service';
import { SettingsService } from '../settings/settings.service';
import { StatsService } from '../stats/stats.service';

import { toPressAssetAdminDetail } from './press-assets.mapper';
import { PressAssetsRepository } from './press-assets.repository';

/**
 * Regenerates the one-page EPK PDF for a persona.
 *
 * Triggered manually from admin (`POST /admin/press-kit/epk/:personaKey`).
 * The masterplan also wants this debounced-automatic on a bio/stats/photo
 * change; that trigger is not wired yet — see STATUS.md.
 */
@Injectable()
export class PressKitGeneratorService {
  constructor(
    private readonly personas: PersonasService,
    private readonly stats: StatsService,
    private readonly settings: SettingsService,
    private readonly media: MediaService,
    private readonly cloudinary: CloudinaryService,
    private readonly repository: PressAssetsRepository,
    private readonly audit: AuditService,
  ) {}

  async regenerateEpk(personaKey: PersonaKey): Promise<PressAssetAdminDetail> {
    const persona = await this.personas.findIdByKey(personaKey);
    if (!persona) {
      throw new NotFoundException({
        message: `No persona exists for key "${personaKey}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const [detail, statsResult, settings] = await Promise.all([
      this.personas.findPublicBySlug(persona.slug, ['genres']),
      this.stats.listPublic({ personaSlug: persona.slug, visibleOnly: true, sort: [], limit: 20 }),
      this.settings.getPublic(),
    ]);

    const pdfBuffer = await renderEpkPdf({
      stageName: detail.stageName,
      subtitle: detail.subtitle,
      bioShort: detail.bioShort ?? detail.bio.slice(0, 600),
      homeCity: detail.homeCity,
      country: detail.country,
      genres: detail.genres.map((g) => g.name),
      stats: statsResult.data.map((s) => ({ label: s.label, value: s.value, suffix: s.suffix })),
      contactEmail: settings.contactEmail,
      bookingEmail: settings.bookingEmail,
      siteName: settings.siteName,
      websiteUrl: `https://${settings.siteName.toLowerCase().replace(/\s+/g, '')}.com`,
    });

    const publicId = `epk-${persona.slug}`;
    const folder = `${this.cloudinary.rootFolder()}/press-kit/epk`;
    const uploaded = await this.cloudinary.uploadBuffer(pdfBuffer, { publicId, folder });

    const media = await this.media.recordServerUpload({
      publicId: uploaded.public_id,
      resourceType: 'RAW',
      format: 'pdf',
      bytes: uploaded.bytes,
      secureUrl: uploaded.secure_url,
      folder,
      purpose: 'DOCUMENT',
      originalFilename: `${persona.slug}-epk.pdf`,
    });

    const existing = await this.repository.findLatestByKindAndPersona(PressAssetKind.EPK_PDF, persona.id);

    const pressAsset = existing
      ? await this.repository.update(existing.id, {
          mediaId: media.id,
          version: { increment: 1 },
          status: 'PUBLISHED',
          publishedAt: existing.publishedAt ?? new Date(),
        })
      : await this.repository.create({
          kind: PressAssetKind.EPK_PDF,
          title: `${detail.stageName} — Press Kit`,
          personaId: persona.id,
          mediaId: media.id,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: 'PressAsset',
      entityId: pressAsset.id,
      metadata: { regeneratedEpk: true, personaKey },
    });

    return toPressAssetAdminDetail(pressAsset);
  }
}
