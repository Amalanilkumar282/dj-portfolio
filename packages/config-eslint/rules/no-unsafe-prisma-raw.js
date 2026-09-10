/**
 * Bans `$queryRawUnsafe` / `$executeRawUnsafe`.
 *
 * The three legitimate raw-SQL call sites (trigram search, advisory locks,
 * analytics rollup) all use `Prisma.sql` tagged templates, which parameterise.
 * The Unsafe variants do not.
 */
const BANNED = new Set(['$queryRawUnsafe', '$executeRawUnsafe']);

export default {
  meta: {
    type: 'problem',
    docs: { description: 'disallow unparameterised Prisma raw queries' },
    schema: [],
    messages: {
      unsafeRaw:
        '{{ name }} interpolates without parameterising. Use Prisma.sql`...` tagged templates instead.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const name = node.property?.name ?? node.property?.value;
        if (BANNED.has(name)) {
          context.report({ node, messageId: 'unsafeRaw', data: { name } });
        }
      },
    };
  },
};
