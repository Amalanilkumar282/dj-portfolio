import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { NewsletterConfirmDto, NewsletterSubscribeDto, NewsletterUnsubscribeDto } from './dto/newsletter.dto';
import { NewsletterService } from './newsletter.service';

@ApiTags('newsletter')
@Controller('newsletter')
@Public()
@CacheControl(CACHE_POLICIES.noStore)
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Start double opt-in — sends a confirmation email' })
  async subscribe(@Body() dto: NewsletterSubscribeDto): Promise<void> {
    await this.newsletter.subscribe(dto, new Date());
  }

  @Post('confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm a subscription from the emailed link' })
  async confirm(@Body() dto: NewsletterConfirmDto): Promise<void> {
    await this.newsletter.confirm(dto.token, new Date());
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from the emailed link' })
  async unsubscribe(@Body() dto: NewsletterUnsubscribeDto): Promise<void> {
    await this.newsletter.unsubscribe(dto.token, new Date());
  }
}
