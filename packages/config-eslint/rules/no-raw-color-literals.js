/**
 * Bans raw hex / rgb() / hsl() / oklch() color literals in application code.
 *
 * The legacy site carried three competing colour systems across three CSS
 * files. Colour lives in exactly one place now: the `@theme` block in
 * packages/ui/src/styles/theme.css. Components consume semantic tokens.
 *
 * See docs/03-design-system/tokens.md.
 */
const COLOR =
  /(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\()/;

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'disallow raw colour literals outside the theme layer' },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      rawColor:
        'Raw colour literal "{{ value }}". Use a semantic token (var(--color-accent), bg-surface, text-fg-muted). Colour is defined only in packages/ui/src/styles/theme.css. See docs/03-design-system/tokens.md.',
    },
  },
  create(context) {
    const allow = new Set(context.options[0]?.allow ?? []);

    function check(node, value) {
      if (typeof value !== 'string' || allow.has(value)) return;
      const match = COLOR.exec(value);
      if (match) {
        context.report({ node, messageId: 'rawColor', data: { value: match[0] } });
      }
    }

    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};
