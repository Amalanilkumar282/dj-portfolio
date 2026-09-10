import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

import { base } from './base.js';
import { djPlugin } from './rules/index.js';

const NO_APP_IMPORT_MESSAGE =
  'Shared packages must not import from apps/. Invert the dependency with a prop or a token.';

/** packages/ui, packages/motion - shared React libraries. */
export const reactLib = tseslint.config(...base, {
  files: ['**/*.{ts,tsx}'],
  plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y, dj: djPlugin },
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  settings: { react: { version: 'detect' } },
  rules: {
    ...react.configs.flat.recommended.rules,
    ...react.configs.flat['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
    ...jsxA11y.flatConfigs.strict.rules,
    'react/prop-types': 'off',
    'dj/no-raw-color-literals': 'error',

    'no-restricted-imports': [
      'error',
      { patterns: [{ group: ['**/apps/**'], message: NO_APP_IMPORT_MESSAGE }] },
    ],
  },
});

export default reactLib;
