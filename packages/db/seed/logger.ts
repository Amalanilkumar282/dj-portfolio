/* eslint-disable no-console */

/**
 * Minimal seed logger.
 *
 * Seeds run from the CLI and from CI, where structured logging buys nothing
 * and legible progress buys a lot. Kept separate so the seed modules stay
 * free of console calls.
 */
export interface SeedLogger {
  section: (name: string) => void;
  step: (message: string) => void;
  warn: (message: string) => void;
  done: (message: string) => void;
}

export function createSeedLogger(): SeedLogger {
  return {
    section: (name) => {
      console.log(`\n── ${name} ────────────────────────`);
    },
    step: (message) => {
      console.log(`   ✓ ${message}`);
    },
    warn: (message) => {
      console.warn(`   ! ${message}`);
    },
    done: (message) => {
      console.log(`\n${message}\n`);
    },
  };
}
