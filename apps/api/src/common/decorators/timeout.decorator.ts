import { SetMetadata } from '@nestjs/common';

import { TIMEOUT_KEY } from '../constants';

/**
 * Overrides the default 15s handler timeout.
 *
 * Raise it only for something genuinely long-running (press-kit PDF
 * generation, a bulk reorder). A handler that needs longer than a few seconds
 * is usually a job in disguise.
 */
export const Timeout = (ms: number) => SetMetadata(TIMEOUT_KEY, ms);
