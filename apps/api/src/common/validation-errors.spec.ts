import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fieldErrorsFrom, toFieldErrors, ValidationFailedException } from './validation-errors';

/**
 * The validation error contract.
 *
 * These tests exist because the failure they guard against was **silent**: the
 * API was returning 400 with raw Zod issues (`path` arrays,
 * `expected`/`received`) while its own problem body claimed `"status": 422`.
 * Nothing threw. The response was valid JSON, just not the documented
 * contract — and Phase 11's admin forms would have been built against the
 * accidental shape.
 *
 * See docs/02-architecture/api-conventions.md
 */

function issuesFor(schema: z.ZodTypeAny, value: unknown): z.ZodError {
  const result = schema.safeParse(value);
  if (result.success) throw new Error('expected the schema to reject this value');
  return result.error;
}

describe('toFieldErrors', () => {
  it('renders a nested path as a JSON Pointer', () => {
    const schema = z.object({ seo: z.object({ title: z.string() }) });

    const errors = toFieldErrors(issuesFor(schema, { seo: {} }));

    // The pointer form is what lets an admin form bind an error to a field
    // mechanically instead of string-matching the message.
    expect(errors[0]?.pointer).toBe('/seo/title');
  });

  it('renders an array index as a path segment', () => {
    const schema = z.object({ entries: z.array(z.object({ id: z.string() })) });

    const errors = toFieldErrors(issuesFor(schema, { entries: [{ id: 1 }] }));

    expect(errors[0]?.pointer).toBe('/entries/0/id');
  });

  it('renders a whole-document error as "/", per RFC 6901', () => {
    // An empty path must not collapse to '', which is not a valid pointer and
    // which a form would try to bind to a field literally named ''.
    const schema = z.object({ a: z.string() }).refine(() => false, 'the whole thing is wrong');

    const errors = toFieldErrors(issuesFor(schema, { a: 'x' }));

    expect(errors[0]?.pointer).toBe('/');
  });

  it('carries the machine-readable code, not only the message', () => {
    const errors = toFieldErrors(
      issuesFor(z.object({ email: z.string().email() }), { email: 'x' }),
    );

    expect(errors[0]?.code).toBeTypeOf('string');
    expect(errors[0]?.message).toBeTypeOf('string');
  });

  it('reports every failing field, not just the first', () => {
    // A form that can only show one error at a time makes the user submit
    // repeatedly to discover the rest.
    const schema = z.object({ a: z.string(), b: z.string() });

    expect(toFieldErrors(issuesFor(schema, {}))).toHaveLength(2);
  });
});

describe('fieldErrorsFrom', () => {
  it('recognises a real ZodError', () => {
    expect(fieldErrorsFrom(issuesFor(z.string(), 1))).toHaveLength(1);
  });

  it('recognises a Zod-shaped error from a different copy of zod', () => {
    // The reason this is structural rather than `instanceof`: nestjs-zod
    // resolves its own zod, and pnpm's isolated linker makes a duplicate copy
    // easy to acquire. `instanceof` then returns false and the error degrades
    // to raw internals with no warning.
    const foreign = { issues: [{ path: ['email'], code: 'invalid_string', message: 'Invalid' }] };

    expect(fieldErrorsFrom(foreign)).toEqual([
      { pointer: '/email', code: 'invalid_string', message: 'Invalid' },
    ]);
  });

  it('rejects anything that is not Zod-shaped', () => {
    for (const value of [undefined, null, {}, 'nope', { issues: 'not-an-array' }]) {
      expect(fieldErrorsFrom(value)).toBeUndefined();
    }
  });

  it('rejects an issues array whose entries are the wrong shape', () => {
    // Half-matching input is the dangerous case: passing it through would
    // produce `pointer: undefined` on the wire.
    expect(fieldErrorsFrom({ issues: [{ message: 'no path' }] })).toBeUndefined();
  });
});

describe('ValidationFailedException', () => {
  it('is a 422, not a 400', () => {
    // api-conventions.md reserves 400 for a request the server could not
    // parse at all. nestjs-zod's own exception extends BadRequestException,
    // which is what produced the mismatched status.
    const exception = new ValidationFailedException([{ pointer: '/a', message: 'bad' }]);

    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('carries the error code and the field errors', () => {
    const errors = [{ pointer: '/a', message: 'bad' }];
    const payload = new ValidationFailedException(errors).getResponse() as Record<string, unknown>;

    expect(payload.code).toBe('VALIDATION_FAILED');
    expect(payload.errors).toEqual(errors);
  });
});
