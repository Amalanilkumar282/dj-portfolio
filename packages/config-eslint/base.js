import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { djPlugin } from './rules/index.js';

/** Shared flat config for every package in the monorepo. */
export const base = tseslint.config(
  {
    ignores: [
      'dist/**',
      '.next/**',
      '.turbo/**',
      'coverage/**',
      'node_modules/**',
      // The flat config files themselves. They sit outside every tsconfig
      // project, so type-aware rules cannot resolve them, and linting the
      // linter's own configuration buys nothing.
      '**/eslint.config.{js,mjs,cjs,ts}',
      '**/prettier.config.{js,mjs,cjs}',
      '**/vitest.config.ts',
      '**/postcss.config.{js,mjs,cjs}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
      parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
    },
    plugins: { 'import-x': importX, dj: djPlugin },
    rules: {
      // Local architectural invariants.
      'dj/no-unsafe-prisma-raw': 'error',

      // Allow the underscore escape hatch for intentionally-ignored bindings.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // Type-only imports must be explicit: verbatimModuleSyntax is on.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Floating promises are the top source of silent failures in Nest
      // services and server actions alike.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // Nullish coalescing matters where 0 and empty string are meaningful
      // values (bpm, sortIndex, playCount).
      '@typescript-eslint/prefer-nullish-coalescing': 'error',

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // Type imports sort alongside their source group rather than into a
      // trailing block, which matches the inline `import type` style
      // `consistent-type-imports` enforces.
      'import-x/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@dj/**', group: 'internal', position: 'before' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'error',
      'import-x/no-cycle': ['error', { maxDepth: 4 }],
    },
  },
  {
    // Config and script files run outside the type-checked project graph, so
    // type-aware rules cannot resolve them.
    files: ['**/*.config.{ts,mts,js,mjs}', '**/scripts/**/*.ts', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      // The spread above carries its own `rules`, so this must merge rather
      // than replace — declaring a bare `rules` key here would silently
      // discard every rule disableTypeChecked turns off.
      ...tseslint.configs.disableTypeChecked.rules,
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.{spec,test,int-spec}.ts', '**/*.{spec,test}.tsx', '**/test/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-console': 'off',
    },
  },
  prettier,
);

export default base;
