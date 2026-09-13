# 0018 — Validation failures are 422, with JSON Pointer field errors

**Status:** Accepted · **Date:** 2026-09-11 (during Phase 4)

## Context

`api-conventions.md` has always specified that a validation failure is a
**422** carrying `errors[].pointer` as a JSON Pointer, so an admin form can
bind an error to a field mechanically instead of string-matching the message.

The implementation did not do that, and nothing failed loudly enough to say
so. `nestjs-zod`'s `ZodValidationPipe` throws a `BadRequestException`, and its
payload carries the **raw Zod issues**. The result:

```jsonc
// what clients actually got — HTTP 400
{
  "status": 400, // and the body disagreed with the status line
  "detail": "Validation failed",
  "errors": [
    {
      "validation": "email",
      "code": "invalid_string",
      "message": "Invalid email",
      "path": ["email"],
    }, // an array, not a pointer
  ],
}
```

Two things are wrong and neither raises an error. The status line said 400
while the body said 422 in some paths. And `path: ["email"]` is a different
contract from `pointer: "/email"` — a frontend written against it works
perfectly, and is then broken by any correction.

This was found only because an e2e test asserted the documented contract
rather than the observed behaviour. Had the admin app been built first, the
accidental shape would have become the real one.

## Decision

**422 for a request the server understood but cannot accept. 400 only for a
request it could not parse** (malformed JSON, an undecodable cursor).

- `common/validation-errors.ts` owns the single conversion from Zod issues to
  `FieldError[]`, and exports `ValidationFailedException`, which extends
  `UnprocessableEntityException`.
- `common/pipes/zod-validation.pipe.ts` wraps nestjs-zod's factory with
  `createValidationException`, so the correct status is set **where the error
  is thrown** rather than patched downstream.
- `AllExceptionsFilter` uses the same conversion, and **normalises** any
  `errors` array it finds rather than casting it. The blind
  `as ProblemDetails['errors']` cast was how the raw issues reached clients
  while the types insisted everything was fine.
- An empty Zod path renders as `"/"` — the whole document, per RFC 6901 —
  never as `""`, which a form would try to bind to a field named `''`.

Zod-shaped errors are detected **structurally**, not with `instanceof
ZodError`. nestjs-zod resolves its own copy of `zod`, and pnpm's isolated
linker makes duplicate copies easy to acquire without noticing; `instanceof`
then quietly returns false and the error degrades to raw internals. A
structural check cannot fail that way.

## Consequences

- `errors[].pointer` is now guaranteed, and the admin forms in Phase 11 can
  rely on it.
- Unknown request properties are **422 `unrecognized_keys`**, not silently
  stripped — see `inputObject()` in `@dj/contracts`, which is `.strict()`.
- `common/validation-errors.spec.ts` covers the contract, including the
  foreign-zod case. It exists because every failure here is silent: the
  response stays valid JSON in the wrong shape.
- Anyone replacing the validation pipe must preserve both the status and the
  pointer shape. The OpenAPI snapshot gate will not catch a change in error
  _bodies_, so those tests are the only guard.

## Alternatives considered

**Map 400 → 422 in the exception filter.** Would work, and would leave every
`BadRequestException` in the codebase ambiguous — there would be no way to
express a genuine 400. Fixing the status at the throw site keeps the two
meanings distinct.

**Accept nestjs-zod's shape and document that instead.** Cheaper today. It
would mean the API's error contract is whatever a dependency happens to emit,
changing under us on a minor upgrade, and it would leak Zod as an
implementation detail into every client.
