/**
 * Bans `'use client'` at the top of App Router `page.tsx` / `layout.tsx`.
 *
 * The legacy site marked every page as a Client Component, which cost it all
 * SSR and made per-route `metadata` impossible. Client behaviour belongs in
 * leaf islands, not route entry points.
 *
 * See docs/02-architecture/frontend.md §"Server-first".
 */
const ROUTE_FILE = /[\/]app[\/].*[\/]?(page|layout)\.(t|j)sx?$/;

export default {
  meta: {
    type: 'problem',
    docs: {
      description: "disallow 'use client' in App Router page/layout files",
    },
    schema: [],
    messages: {
      noClientRoute:
        "'use client' is not allowed in {{ basename }}. Route entry points must be Server Components — move interactivity into a leaf client island. See docs/02-architecture/frontend.md.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!ROUTE_FILE.test(filename)) return {};

    return {
      Program(node) {
        for (const stmt of node.body) {
          if (
            stmt.type !== 'ExpressionStatement' ||
            stmt.expression.type !== 'Literal' ||
            typeof stmt.expression.value !== 'string'
          ) {
            break; // directives must be first; stop at the first non-directive
          }
          if (stmt.expression.value === 'use client') {
            context.report({
              node: stmt,
              messageId: 'noClientRoute',
              data: { basename: filename.split(/[\/]/).pop() },
            });
          }
        }
      },
    };
  },
};
