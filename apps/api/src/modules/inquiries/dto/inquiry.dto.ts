import { createZodDto } from 'nestjs-zod';

import { BookingInquiryCreateInput, InquiryAdminQuery, InquiryNoteCreateInput, InquiryUpdateInput } from '@dj/contracts';

export class InquiryCreateDto extends createZodDto(BookingInquiryCreateInput) {}
export class InquiryUpdateDto extends createZodDto(InquiryUpdateInput) {}
export class InquiryNoteCreateDto extends createZodDto(InquiryNoteCreateInput) {}
export class InquiryAdminQueryDto extends createZodDto(InquiryAdminQuery) {}
