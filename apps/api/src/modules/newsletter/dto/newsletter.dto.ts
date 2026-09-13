import { createZodDto } from 'nestjs-zod';

import {
  NewsletterAdminQuery,
  NewsletterConfirmInput,
  NewsletterSubscribeInput,
  NewsletterUnsubscribeInput,
} from '@dj/contracts';

export class NewsletterSubscribeDto extends createZodDto(NewsletterSubscribeInput) {}
export class NewsletterConfirmDto extends createZodDto(NewsletterConfirmInput) {}
export class NewsletterUnsubscribeDto extends createZodDto(NewsletterUnsubscribeInput) {}
export class NewsletterAdminQueryDto extends createZodDto(NewsletterAdminQuery) {}
