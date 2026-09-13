import { Module } from '@nestjs/common';

import { MailModule } from '../../infra/mail/mail.module';

import { NewsletterAdminController } from './newsletter.admin.controller';
import { NewsletterController } from './newsletter.controller';
import { NewsletterRepository } from './newsletter.repository';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [MailModule],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterRepository, NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
