import { createZodDto } from 'nestjs-zod';

import { ChangePasswordInput, LoginInput, TotpDisableInput, TotpVerifyInput } from '@dj/contracts';

/**
 * DTOs are thin wrappers over the Zod contracts.
 *
 * `createZodDto` gives Nest a class to attach to a parameter (so DI and
 * Swagger both work) while the schema stays the single source of truth shared
 * with the admin form. See
 * docs/01-decisions/0004-zod-contracts-over-openapi-codegen.md
 */

export class LoginDto extends createZodDto(LoginInput) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordInput) {}
export class TotpVerifyDto extends createZodDto(TotpVerifyInput) {}
export class TotpDisableDto extends createZodDto(TotpDisableInput) {}
