import { SetMetadata } from '@nestjs/common';

import { IDEMPOTENT_KEY } from '../constants';

/**
 * Opts a mutation into Idempotency-Key handling.
 *
 * Applied to anything a double-tapped button could duplicate: booking
 * enquiries, newsletter signups, media registration, and every admin create.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
