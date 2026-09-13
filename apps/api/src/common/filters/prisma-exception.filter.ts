import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { Prisma } from '@dj/db';

import { ERROR_CODES, problemTypeFor, titleFor } from '../problems';
import { formatRequestId } from '../request-id';
import type { AppRequest } from '../types';

import type { ProblemDetails } from './all-exceptions.filter';

/**
 * Maps Prisma errors onto meaningful HTTP status codes.
 *
 * Without this every constraint violation is a 500, which is both wrong and
 * unhelpful: a duplicate slug is the caller's problem (409) and a check
 * violation means the request asked for something the schema forbids (422).
 *
 * The `pointer` on a unique violation comes from `meta.target`, so an admin
 * form can highlight the offending field — usually `slug`.
 *
 * Constraint names are matched against `prisma/sql/post-migrate.sql`. Adding a
 * CHECK constraint there means adding a case here, or the client sees a bare
 * "violates a database constraint" with no idea which.
 *
 * See docs/02-architecture/api-conventions.md
 */

/** Human explanations for the CHECK constraints we define ourselves. */
const CHECK_CONSTRAINT_MESSAGES: Record<string, string> = {
  site_settings_singleton: 'There can only be one site settings record.',
  testimonials_rating_range: 'Rating must be between 1 and 5.',
  services_price_band: 'The minimum price must not exceed the maximum price.',
  booking_inquiries_budget_band: 'The minimum budget must not exceed the maximum budget.',
  events_ticket_price_band: 'The minimum ticket price must not exceed the maximum.',
  events_time_order: 'An event cannot end before it starts.',
  experience_entries_date_order: 'An entry cannot end before it starts.',
  personas_published_has_date: 'Published content must have a publish date.',
  tracks_published_has_date: 'Published content must have a publish date.',
  events_published_has_date: 'Published content must have a publish date.',
  posts_published_has_date: 'Published content must have a publish date.',
  media_assets_image_alt_text: 'Images require alt text before they can be saved.',
};

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<AppRequest>();
    const response = ctx.getResponse<Response>();

    const problem = this.toProblem(exception, request);

    if (problem.status >= 500) {
      this.logger.error(
        `prisma_error path=${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `prisma_constraint status=${String(problem.status)} code=${problem.code ?? '-'} path=${request.originalUrl}`,
      );
    }

    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, request: AppRequest): ProblemDetails {
    const base = {
      instance: request.originalUrl,
      // pino-http types `req.id` as ReqId, so normalise to string here.
      requestId: formatRequestId(request.id),
    };

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        // Unique constraint violation.
        case 'P2002': {
          const target = exception.meta?.target;
          const fields = Array.isArray(target) ? target.map(String) : [];

          return {
            ...base,
            type: problemTypeFor(409),
            title: titleFor(409),
            status: 409,
            detail:
              fields.length > 0
                ? `A record with this ${fields.join(' and ')} already exists.`
                : 'A record with these values already exists.',
            code: ERROR_CODES.UNIQUE_CONSTRAINT,
            errors: fields.map((field) => ({
              pointer: `/${field}`,
              code: 'unique',
              message: 'Already taken.',
            })),
          };
        }

        // Record not found for an update or delete.
        case 'P2025':
          return {
            ...base,
            type: problemTypeFor(404),
            title: titleFor(404),
            status: 404,
            detail: 'The requested record does not exist.',
            code: ERROR_CODES.NOT_FOUND,
          };

        // Foreign key constraint. Usually a referenced row that is gone, or a
        // delete that would orphan children.
        case 'P2003':
          return {
            ...base,
            type: problemTypeFor(409),
            title: titleFor(409),
            status: 409,
            detail: 'This record is referenced by other records.',
            code: ERROR_CODES.FOREIGN_KEY_CONSTRAINT,
          };

        // Required relation violation.
        case 'P2014':
          return {
            ...base,
            type: problemTypeFor(409),
            title: titleFor(409),
            status: 409,
            detail: 'The change would break a required relation.',
            code: ERROR_CODES.FOREIGN_KEY_CONSTRAINT,
          };

        // A CHECK constraint from post-migrate.sql.
        case 'P2010':
        case 'P2004': {
          const name = this.extractConstraintName(exception.message);

          return {
            ...base,
            type: problemTypeFor(422),
            title: titleFor(422),
            status: 422,
            detail:
              (name ? CHECK_CONSTRAINT_MESSAGES[name] : undefined) ??
              'The request violates a database constraint.',
            code: ERROR_CODES.CHECK_CONSTRAINT,
          };
        }

        default:
          return {
            ...base,
            type: problemTypeFor(500),
            title: titleFor(500),
            status: 500,
            detail: 'A database error occurred.',
            code: ERROR_CODES.INTERNAL,
          };
      }
    }

    // A validation error means we built a malformed query — always our bug.
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        type: problemTypeFor(500),
        title: titleFor(500),
        status: 500,
        detail: 'A database error occurred.',
        code: ERROR_CODES.INTERNAL,
      };
    }

    // Cannot reach the database. 503 rather than 500, so an uptime monitor and
    // a load balancer both read it correctly as "try again".
    return {
      ...base,
      type: problemTypeFor(503),
      title: titleFor(503),
      status: 503,
      detail: 'The service is temporarily unavailable.',
      code: ERROR_CODES.INTERNAL,
    };
  }

  /** Pulls a constraint name out of a Postgres error message. */
  private extractConstraintName(message: string): string | undefined {
    return /constraint "?([a-z0-9_]+)"?/i.exec(message)?.[1];
  }
}
