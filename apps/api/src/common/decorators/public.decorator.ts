import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../constants';

/**
 * Marks a route as reachable without authentication.
 *
 * The global JwtAccessGuard denies by DEFAULT, so this is the only way to open
 * a route. That direction is deliberate: forgetting this decorator produces a
 * locked endpoint, which is visible immediately, whereas forgetting an
 * @UseGuards would have produced an open one, which is not.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
