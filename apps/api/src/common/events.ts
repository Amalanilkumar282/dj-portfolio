import type { Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * DI token for the domain event bus.
 *
 * ## Why this exists rather than injecting `EventEmitter2` directly
 *
 * `@nestjs/event-emitter`'s type declaration is wrong:
 *
 * ```ts
 * import eventemitter2 from 'eventemitter2';
 * export declare const EventEmitter2: typeof eventemitter2.EventEmitter2;
 * ```
 *
 * It reads `.EventEmitter2` off the *default* export. At runtime, with
 * `esModuleInterop`, that default is the whole CJS `module.exports` and the
 * property is there — but the declared default export is the class itself,
 * which has no such property. So the type resolves to an **error type**, and
 * an error type propagates silently as `any`.
 *
 * The consequence is not cosmetic: every `this.events.emit(...)` in a service
 * that injected `EventEmitter2` was an unchecked call, so a typo in the event
 * name or a malformed payload would not have been caught by the type system
 * at all — in the one place whose whole job is telling the web app what to
 * revalidate.
 *
 * So the broken reference is confined to the single cast below, with the
 * reason written down, and every service injects `DOMAIN_EVENT_BUS` typed as
 * `DomainEventBus` instead. Those calls are fully checked.
 *
 * Revisit if the upstream declaration is fixed.
 */
export const DOMAIN_EVENT_BUS = 'dj:domainEventBus';

/**
 * Aliases the token onto the emitter `EventEmitterModule` already provides.
 *
 * `useExisting`, not `useClass`: there must be exactly one emitter, or a
 * listener registered against one instance never hears an event emitted on
 * another — which fails silently as "I published but nothing revalidated".
 *
 * This is the **only** place `EventEmitter2` is referenced, and the only
 * suppression. Because its declaration resolves to an *error* type rather
 * than merely a wrong one, no cast satisfies the linter: asserting it away is
 * reported as an unnecessary assertion, and leaving it is reported as an
 * unsafe assignment. Containing it in one line with the reason stated beats
 * contorting the surrounding code, and every consumer downstream is fully
 * checked against `DomainEventBus`.
 */
export const domainEventBusProvider: Provider = {
  provide: DOMAIN_EVENT_BUS,
  // Upstream declaration bug, contained here on purpose — see above.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  useExisting: EventEmitter2,
};
