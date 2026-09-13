import { UnprocessableEntityException } from '@nestjs/common';
import { ZodError } from 'zod';

import { ERROR_CODES } from './problems';

/** One field error, addressed by JSON Pointer. */
export interface FieldError {
  pointer: string;
  code?: string | undefined;
  message: string;
}

/**
 * Anything shaped like a Zod error.
 *
 * Deliberately structural rather than an `instanceof ZodError` check. The
 * error reaching us may have been constructed by a *different copy* of zod —
 * nestjs-zod resolves its own, and pnpm's isolated linker makes duplicate
 * copies easy to acquire without noticing. `instanceof` then returns false and
 * the failure is silent: the error still serialises, just as raw Zod internals
 * instead of our documented contract. Duck-typing cannot fail that way.
 */
interface ZodIssueLike {
  path: (string | number | symbol)[];
  code?: string;
  message: string;
}

interface ZodLikeError {
  issues: ZodIssueLike[];
}

/** True for one issue-shaped entry. Takes `unknown`, so the checks are real. */
function isIssueLike(value: unknown): value is ZodIssueLike {
  if (typeof value !== 'object' || value === null) return false;

  const issue = value as Partial<ZodIssueLike>;
  return Array.isArray(issue.path) && typeof issue.message === 'string';
}

function isZodLike(value: unknown): value is ZodLikeError {
  if (typeof value !== 'object' || value === null) return false;

  const issues: unknown = (value as { issues?: unknown }).issues;
  return Array.isArray(issues) && issues.every(isIssueLike);
}

/**
 * Converts Zod issues into JSON Pointer field errors.
 *
 * The pointer form is what lets an admin form map an error to a field
 * mechanically, rather than string-matching the message — which breaks the
 * first time the wording changes. An empty path becomes `/`, meaning "the
 * document as a whole", per RFC 6901.
 *
 * Note this is the *only* place issues are shaped for the wire, so the pipe
 * and the exception filter cannot drift apart.
 */
export function toFieldErrors(error: ZodError | ZodLikeError): FieldError[] {
  return error.issues.map((issue) => ({
    pointer: issue.path.length > 0 ? `/${issue.path.map(String).join('/')}` : '/',
    code: issue.code,
    message: issue.message,
  }));
}

/** Extracts field errors from anything Zod-shaped, or undefined if it is not. */
export function fieldErrorsFrom(value: unknown): FieldError[] | undefined {
  if (value instanceof ZodError) return toFieldErrors(value);
  if (isZodLike(value)) return toFieldErrors(value);
  return undefined;
}

/**
 * A failed request-body or query validation.
 *
 * **422, not 400.** `api-conventions.md` specifies 422 for `VALIDATION_FAILED`
 * and reserves 400 for a malformed request the server could not even parse.
 * nestjs-zod's own exception extends `BadRequestException`, so relying on it
 * silently produced 400s whose body claimed 422 — a status line and a payload
 * that disagreed. This class exists so the status is correct at the point it
 * is thrown, rather than patched downstream.
 */
export class ValidationFailedException extends UnprocessableEntityException {
  constructor(errors: FieldError[]) {
    super({
      message: 'One or more fields are invalid.',
      code: ERROR_CODES.VALIDATION_FAILED,
      errors,
    });
  }
}
