import next from '@dj/config-eslint/next';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  ...next,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
