import noClientInRouteFiles from './no-client-in-route-files.js';
import noRawColorLiterals from './no-raw-color-literals.js';
import prismaOnlyInRepositories from './prisma-only-in-repositories.js';
import noUnsafePrismaRaw from './no-unsafe-prisma-raw.js';

/** Local rules enforcing this repo's architectural invariants. */
export const djPlugin = {
  meta: { name: '@dj/eslint-plugin-local' },
  rules: {
    'no-client-in-route-files': noClientInRouteFiles,
    'no-raw-color-literals': noRawColorLiterals,
    'prisma-only-in-repositories': prismaOnlyInRepositories,
    'no-unsafe-prisma-raw': noUnsafePrismaRaw,
  },
};

export default djPlugin;
