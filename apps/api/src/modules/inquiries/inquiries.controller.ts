import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { BookingInquiryPublicResult } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';
import { ERROR_CODES } from '../../common/problems';
import type { AppRequest } from '../../common/types';
import { TurnstileService } from '../../infra/turnstile/turnstile.service';

import { InquiryCreateDto } from './dto/inquiry.dto';
import { InquiriesService } from './inquiries.service';

/**
 * The public booking form.
 *
 * Rate-limited to 3/hour/IP — tighter than the global default — because an
 * unthrottled inquiry endpoint is a spam magnet regardless of Turnstile.
 */
@ApiTags('inquiries')
@Controller('inquiries')
@Public()
@CacheControl(CACHE_POLICIES.noStore)
export class InquiriesController {
  constructor(
    private readonly inquiries: InquiriesService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a booking enquiry' })
  async create(
    @Body() dto: InquiryCreateDto,
    @Req() req: AppRequest,
  ): Promise<BookingInquiryPublicResult> {
    const verified = await this.turnstile.verify(dto.turnstileToken, req.ip);
    if (!verified) {
      throw new BadRequestException({
        message: 'Verification failed. Please try again.',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    return this.inquiries.submit(dto, new Date());
  }
}
