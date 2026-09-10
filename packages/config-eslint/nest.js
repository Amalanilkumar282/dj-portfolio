import tseslint from 'typescript-eslint';

import { base } from './base.js';
import { djPlugin } from './rules/index.js';

const CROSS_MODULE_REPO_MESSAGE =
  'Cross-module data access goes through the other module service, never its repository. See docs/02-architecture/backend.md.';

/** apps/api - NestJS. */
export const nest = tseslint.config(...base, {
  files: ['**/*.ts'],
  plugins: { dj: djPlugin },
  rules: {
    'dj/prisma-only-in-repositories': 'error',

    // Nest DI and decorator metadata legitimately need these.
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    '@typescript-eslint/parameter-properties': 'off',
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      { accessibility: 'no-public', overrides: { parameterProperties: 'explicit' } },
    ],

    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/modules/*/*.repository', '**/modules/*/**/*.repository'],
            message: CROSS_MODULE_REPO_MESSAGE,
          },
        ],
      },
    ],
  },
});

export default nest;
