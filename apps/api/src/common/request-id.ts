/**
 * Renders a pino-http request id as a string.
 *
 * `ReqId` is `string | number | object`, so a bare `String(id)` can produce
 * the literal text `[object Object]` — which would be written into every
 * problem response and every log line for the affected request, destroying
 * exactly the traceability the id exists to provide. The object case is
 * unlikely but not impossible: it depends on whatever `genReqId` returns, and
 * on a caller-supplied `x-request-id` header.
 */
export function formatRequestId(id: unknown): string | undefined {
  if (id === undefined || id === null) return undefined;
  if (typeof id === 'string') return id;
  if (typeof id === 'number' || typeof id === 'bigint') return String(id);

  // Anything else: prefer a meaningful own `toString`, else JSON, else give up
  // rather than emit '[object Object]'.
  if (typeof id === 'object') {
    const custom: unknown = (id as { toString?: unknown }).toString;
    if (typeof custom === 'function' && custom !== Object.prototype.toString) {
      return String(custom.call(id));
    }

    try {
      return JSON.stringify(id);
    } catch {
      return undefined;
    }
  }

  return undefined;
}
