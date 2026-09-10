/**
 * Restricts PrismaService / @prisma/client imports to `*.repository.ts` and
 * the `infra/` layer.
 *
 * Keeps every aggregate's data access behind one seam, which is what makes the
 * include-allowlist and N+1 guards enforceable at all.
 *
 * See docs/02-architecture/backend.md §"Feature-module convention".
 */
const ALLOWED = /(\.repository\.ts$|[\/]infra[\/]|\.int-spec\.ts$|[\/]seed[\/])/;
const FORBIDDEN_SOURCE = /(@prisma\/client|@dj\/db|prisma\.service)/;

export default {
  meta: {
    type: 'problem',
    docs: { description: 'restrict Prisma access to repositories and infra' },
    schema: [],
    messages: {
      prismaOutsideRepo:
        'Prisma may only be imported in *.repository.ts or infra/. Controllers and services go through the repository. See docs/02-architecture/backend.md.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (ALLOWED.test(filename)) return {};

    return {
      ImportDeclaration(node) {
        if (FORBIDDEN_SOURCE.test(node.source.value)) {
          // Type-only imports are fine: they carry no runtime coupling.
          if (node.importKind === 'type') return;
          const allSpecifiersAreTypes =
            node.specifiers.length > 0 && node.specifiers.every((s) => s.importKind === 'type');
          if (allSpecifiersAreTypes) return;
          context.report({ node, messageId: 'prismaOutsideRepo' });
        }
      },
    };
  },
};
