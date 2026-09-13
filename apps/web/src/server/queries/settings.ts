import { cache } from 'react';

import { SiteSettingsDetail } from '@dj/contracts';

import { apiGet } from '../../lib/api-client';

export const getSettings = cache(async function getSettings() {
  return apiGet('settings', { schema: SiteSettingsDetail, tags: ['settings'], revalidate: 3600 });
});
