import { Module } from '@nestjs/common';

import { MailModule } from '../../infra/mail/mail.module';
import { TurnstileModule } from '../../infra/turnstile/turnstile.module';
import { PersonasModule } from '../personas/personas.module';
import { SettingsModule } from '../settings/settings.module';

import { InquiriesAdminController } from './inquiries.admin.controller';
import { InquiriesController } from './inquiries.controller';
import { InquiriesRepository } from './inquiries.repository';
import { InquiriesService } from './inquiries.service';
import { InquiryMailListener } from './inquiry-mail.listener';
import { InquiryRetryMailCron } from './inquiry-retry-mail.cron';

@Module({
  imports: [PersonasModule, SettingsModule, MailModule, TurnstileModule],
  controllers: [InquiriesController, InquiriesAdminController],
  providers: [InquiriesRepository, InquiriesService, InquiryMailListener, InquiryRetryMailCron],
  exports: [InquiriesService],
})
export class InquiriesModule {}
