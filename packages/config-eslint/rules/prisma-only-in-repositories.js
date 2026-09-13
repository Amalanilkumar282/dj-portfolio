/**
 * Restricts Prisma **data access** to `*.repository.ts` and the `infra/` layer.
 *
 * Keeps every aggregate's data access behind one seam, which is what makes the
 * include-allowlist and N+1 guards enforceable at all.
 *
 * ## What counts as data access
 *
 * The client and the query-builder namespace, not the whole `@dj/db` package.
 * `@dj/db` also exports domain vocabulary — enums such as `AuditAction` and
 * `ContentStatus` — and stateless helpers such as `publishedWhere()`. Those
 * carry no connection, no delegate and no query surface; a service using
 * `ContentStatus.PUBLISHED` is expressing a domain fact, not reaching past the
 * repository seam. Banning them bought nothing and would have forced every
 * enum to be re-exported through a wrapper, which is indirection that obscures
 * where the value actually comes from.
 *
 * So: `@prisma/client` and `prisma.service` stay off-limits outside the allowed
 * layers, and from `@dj/db` only the identifiers in `FORBIDDEN_DB_IMPORTS` do.
 *
 * See docs/02-architecture/backend.md §"Feature-module convention".
 */
/**
 * Layers exempt from the restriction.
 *
 * Matched against a forward-slash-normalised path. Without normalising,
 * `/infra/` never matches on Windows — where paths arrive as
 * `src\infra\prisma\prisma.service.ts` — so the rule fired on the very files
 * that own Prisma, and the repo linted differently on Windows than in CI.
 *
 * `prisma-exception.filter.ts` is listed because translating Prisma's error
 * classes into RFC 9457 problems is the one job that inherently requires the
 * `Prisma` namespace outside a repository. It reads error codes; it issues no
 * queries.
 */
const ALLOWED =
  /(\.repository\.ts$|\/infra\/|\.int-spec\.ts$|\.e2e-spec\.ts$|\/seed\/|\/prisma-exception\.filter\.ts$)/;

const normalise = (filename) => filename.replace(/\\/g, '/');

/** Modules whose entire value surface is data access. */
const FORBIDDEN_MODULE = /(@prisma\/client|prisma\.service)/;

/** The `@dj/db` exports that ARE the query surface. */
const FORBIDDEN_DB_IMPORTS = new Set([
  'Prisma',
  'PrismaClient',
  'createPrismaClient',
  'getPrismaClient',
]);

const DB_PACKAGE = /^@dj\/db(\/|$)/;

export default {
  meta: {
    type: 'problem',
    docs: { description: 'restrict Prisma data access to repositories and infra' },
    schema: [],
    messages: {
      prismaOutsideRepo:
        'Prisma data access may only be imported in *.repository.ts or infra/. Controllers and services go through the repository. See docs/02-architecture/backend.md.',
      queryBuilderOutsideRepo:
        "'{{name}}' is Prisma's query surface and may only be used in *.repository.ts or infra/. Domain enums and helpers from @dj/db are fine here. See docs/02-architecture/backend.md.",
    },
  },
  create(context) {
    const filename = normalise(context.filename ?? context.getFilename());
    if (ALLOWED.test(filename)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Type-only imports carry no runtime coupling, so they are always
        // fine — including `import type { Prisma }` for a where-clause type.
        if (node.importKind === 'type') return;

        const valueSpecifiers = node.specifiers.filter((s) => s.importKind !== 'type');
        if (valueSpecifiers.length === 0) return;

        if (FORBIDDEN_MODULE.test(source)) {
          context.report({ node, messageId: 'prismaOutsideRepo' });
          return;
        }

        if (!DB_PACKAGE.test(source)) return;

        for (const specifier of valueSpecifiers) {
          const name = specifier.imported?.name;
          if (name && FORBIDDEN_DB_IMPORTS.has(name)) {
            context.report({
              node: specifier,
              messageId: 'queryBuilderOutsideRepo',
              data: { name },
            });
          }
        }
      },
    };
  },
};
