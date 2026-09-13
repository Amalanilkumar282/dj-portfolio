import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

import { ERROR_CODES, problemTypeFor, titleFor } from '../problems';
import { formatRequestId } from '../request-id';
import type { AppRequest } from '../types';
import { type FieldError, fieldErrorsFrom, toFieldErrors } from '../validation-errors';

/**
 * RFC 9457 problem details. The shape of every error this API returns.
 *
 * Optional fields spell out `| undefined` because `exactOptionalPropertyTypes`
 * is on: without it, assigning an explicitly-undefined value is an error even
 * though the property is optional.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string | undefined;
  instance?: string | undefined;
  requestId?: string | undefined;
  code?: string | undefined;
  errors?: FieldError[] | undefined;
}

/**
 * Extracts field errors from a Nest ValidationPipe response, which arrives as
 * `{ message: string[] }` rather than as a structured object.
 */
function messagesToErrors(messages: string[]): FieldError[] {
  return messages.map((message) => ({ pointer: '/', message }));
}

/**
 * Normalises an exception payload's `errors` onto the wire contract.
 *
 * Never casts. A blind `as FieldError[]` here is what let raw Zod issues —
 * `path` arrays, `expected`/`received` internals — reach clients while the
 * types insisted everything was fine. Anything that is not already a pointer
 * error, and is not Zod-shaped, is dropped rather than passed through: a
 * malformed `errors` array is worse than none, because a form will try to
 * bind to it.
 */
function normaliseErrors(value: unknown): FieldError[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const zodErrors = fieldErrorsFrom({ issues: value });
  if (zodErrors) return zodErrors;

  const pointerErrors = value.filter(
    (entry): entry is FieldError =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as FieldError).pointer === 'string' &&
      typeof (entry as FieldError).message === 'string',
  );

  return pointerErrors.length > 0 ? pointerErrors : undefined;
}

/**
 * The catch-all exception filter.
 *
 * Registered LAST among the filters, so the more specific Prisma filter gets
 * first refusal. Nest applies filters in reverse registration order, which is
 * counter-intuitive enough to be worth stating: see the provider array in
 * app.module.ts.
 *
 * Two rules this file exists to enforce:
 *
 * 1. **Every error carries a `requestId`.** That is the whole traceability
 *    story — the id is in the response, in the access log and in Sentry.
 * 2. **5xx never leaks internals.** The message and stack go to the log; the
 *    client gets a generic title. Anything else is an information disclosure
 *    bug waiting to be found.
 *
 * See docs/02-architecture/api-conventions.md
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<AppRequest>();
    const response = ctx.getResponse<Response>();

    const problem = this.toProblem(exception, request);

    if (problem.status >= 500) {
      // Full detail to the log, never to the client.
      this.logger.error(
        `unhandled_exception status=${String(problem.status)} path=${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `request_failed status=${String(problem.status)} code=${problem.code ?? '-'} path=${request.originalUrl}`,
      );
    }

    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, request: AppRequest): ProblemDetails {
    const base = {
      instance: request.originalUrl,
      // pino-http types `req.id` as ReqId (string | number | object), so
      // it is normalised here rather than widening the wire contract.
      requestId: formatRequestId(request.id),
    };

    // --- Zod, thrown directly by a service or a manual parse ---------------
    if (exception instanceof ZodError) {
      return {
        ...base,
        type: problemTypeFor(422),
        title: titleFor(422),
        status: 422,
        detail: 'One or more fields are invalid.',
        code: ERROR_CODES.VALIDATION_FAILED,
        errors: toFieldErrors(exception),
      };
    }

    // --- Any HttpException, including everything nestjs-zod throws --------
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return {
          ...base,
          type: problemTypeFor(status),
          title: titleFor(status),
          status,
          detail: payload,
        };
      }

      const record = payload as Record<string, unknown>;
      const rawMessage = record.message;

      return {
        ...base,
        type: problemTypeFor(status),
        title: titleFor(status),
        status,
        detail: Array.isArray(rawMessage)
          ? 'One or more fields are invalid.'
          : typeof rawMessage === 'string'
            ? rawMessage
            : undefined,
        code: typeof record.code === 'string' ? record.code : undefined,
        errors: Array.isArray(rawMessage)
          ? messagesToErrors(rawMessage.map(String))
          : normaliseErrors(record.errors),
      };
    }

    // --- Anything else is a bug ------------------------------------------
    return {
      ...base,
      type: problemTypeFor(500),
      title: titleFor(500),
      status: 500,
      detail: 'An unexpected error occurred.',
      code: ERROR_CODES.INTERNAL,
    };
  }
}
