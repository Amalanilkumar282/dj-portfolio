/**
 * Narrowing helpers.
 */

/**
 * Exhaustiveness guard for discriminated unions and enums.
 *
 * Paired with `switch-exhaustiveness-check` in the ESLint config, this turns
 * "a new ContentStatus was added and one switch was missed" into a compile
 * error rather than a runtime surprise.
 */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

/**
 * Array-filter-friendly presence check.
 *
 * `items.filter(isDefined)` narrows `(T | null | undefined)[]` to `T[]`,
 * which a bare `Boolean` filter does not.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}
