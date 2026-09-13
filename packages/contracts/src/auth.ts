import { z } from 'zod';

import { Id, inputObject } from './common.js';

/**
 * Auth contracts.
 *
 * These drive the Nest DTOs, the OpenAPI document and the admin login form
 * from one definition. See
 * docs/01-decisions/0004-zod-contracts-over-openapi-codegen.md
 */

/**
 * Minimum 12 characters, checked against a breached-password dictionary
 * server-side.
 *
 * Deliberately no character-class requirements: they push people towards
 * `Password1!` and are worse than length. NIST dropped them years ago.
 */
export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(256, 'Password must be at most 256 characters.');

export const LoginInput = inputObject({
  email: z.string().email().max(320).toLowerCase().trim(),
  password: z.string().min(1).max(256),
  /** Six-digit TOTP, or an eight-character recovery code. */
  totp: z.string().min(6).max(16).optional(),
});
export type LoginInput = z.infer<typeof LoginInput>;

/**
 * The access token is returned in the body and held in memory by the client.
 * The refresh token is NOT here — it is set as an httpOnly cookie, so
 * JavaScript can never read it.
 */
export const LoginResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: z.object({
    id: Id,
    email: z.string().email(),
    name: z.string(),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
    totpEnabled: z.boolean(),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

/** Issued when credentials are valid but a second factor is still required. */
export const TotpRequiredResponse = z.object({
  totpRequired: z.literal(true),
});
export type TotpRequiredResponse = z.infer<typeof TotpRequiredResponse>;

export const RefreshResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

export const ChangePasswordInput = inputObject({
  currentPassword: z.string().min(1).max(256),
  newPassword: PasswordSchema,
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: 'The new password must differ from the current one.',
  path: ['newPassword'],
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const ForgotPasswordInput = inputObject({
  email: z.string().email().max(320).toLowerCase().trim(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInput>;

export const ResetPasswordInput = inputObject({
  token: z.string().min(32).max(256),
  newPassword: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

/**
 * Enrolment returns the otpauth:// URI for the QR code, plus one-time
 * recovery codes. The codes are shown **once** and stored only as argon2
 * hashes, so a database read cannot recover them.
 */
export const TotpEnrollResponse = z.object({
  otpauthUrl: z.string(),
  recoveryCodes: z.array(z.string()),
});
export type TotpEnrollResponse = z.infer<typeof TotpEnrollResponse>;

export const TotpVerifyInput = inputObject({
  totp: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'Must be six digits.'),
});
export type TotpVerifyInput = z.infer<typeof TotpVerifyInput>;

export const TotpDisableInput = inputObject({
  /** Re-entered, so a hijacked session cannot silently remove the second factor. */
  password: z.string().min(1).max(256),
});
export type TotpDisableInput = z.infer<typeof TotpDisableInput>;

export const CurrentUserResponse = z.object({
  id: Id,
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  totpEnabled: z.boolean(),
  lastLoginAt: z.coerce.date().nullable(),
});
export type CurrentUserResponse = z.infer<typeof CurrentUserResponse>;
