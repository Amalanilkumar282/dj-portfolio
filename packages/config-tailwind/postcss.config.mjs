/**
 * Tailwind v4 is CSS-first: there is no JS theme config.
 * All design tokens live in packages/ui/src/styles/theme.css.
 * See docs/03-design-system/tokens.md.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
