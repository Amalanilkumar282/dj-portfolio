import { createZodValidationPipe } from 'nestjs-zod';

import { fieldErrorsFrom, ValidationFailedException } from '../validation-errors';

/**
 * The global validation pipe.
 *
 * Wraps nestjs-zod's pipe purely to own the exception it throws. Two things
 * were wrong with the stock one, both of which reached clients:
 *
 * 1. It throws a `BadRequestException`, so validation failures came back as
 *    **400** while the body claimed `"status": 422`.
 * 2. Its payload carries the **raw Zod issues** — `path` as an array, plus
 *    `expected`/`received`/`validation` internals — instead of the JSON
 *    Pointer field errors `api-conventions.md` documents. Admin forms are
 *    specified to map errors to fields by pointer; against the raw shape they
 *    would have been built to string-match zod's wording instead.
 *
 * Neither failed loudly. The response was still valid JSON, just the wrong
 * contract, which is exactly the kind of thing that ossifies once a frontend
 * has been written against it.
 *
 * See docs/02-architecture/api-conventions.md
 */
export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) => {
    const errors = fieldErrorsFrom(error);

    // A non-Zod error here means nestjs-zod changed what it hands us. Surface
    // it rather than swallowing it into an empty `errors` array that would
    // read as "invalid, but we won't say why".
    if (!errors) {
      return error instanceof Error ? error : new Error(String(error));
    }

    return new ValidationFailedException(errors);
  },
});
