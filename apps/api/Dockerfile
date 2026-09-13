# apps/api — production image.
#
# This did not exist despite docs/05-operations/deployment.md describing a
# Docker-based deploy; building the API into a container was structurally
# impossible until this file existed. A monorepo-aware multi-stage build:
# install once at the workspace root (pnpm needs every package.json present
# to resolve the lockfile), generate the Prisma client, build with Turborepo
# (which builds @dj/db/@dj/contracts/@dj/utils first, per turbo.json's
# `dependsOn: ["^build"]`), then copy only the built output and production
# dependencies into a slim runtime layer.
#
# Build from the REPO ROOT, not this directory:
#   docker build -f apps/api/Dockerfile -t dj-api .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install the full workspace -------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/motion/package.json packages/motion/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config-ts/package.json packages/config-ts/package.json
COPY packages/config-eslint/package.json packages/config-eslint/package.json
COPY packages/config-tailwind/package.json packages/config-tailwind/package.json
RUN pnpm install --frozen-lockfile

# ---- build: generate the Prisma client, then build @dj/api and its
# workspace dependencies -----------------------------------------------------
FROM deps AS build
COPY . .
# `prisma generate` only reads schema.prisma — no live database needed — but
# prisma.config.ts still expects the env var to exist, hence the placeholder.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm --filter @dj/db exec prisma generate
RUN pnpm exec turbo build --filter=@dj/api

# ---- runtime: a slim image with only what apps/api needs to run -----------
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/packages/db ./packages/db
COPY --from=build /repo/packages/contracts ./packages/contracts
COPY --from=build /repo/packages/utils ./packages/utils

EXPOSE 4000
# Railway/Render set $PORT; apps/api/src/main.ts reads it — see env.schema.ts.
CMD ["node", "--enable-source-maps", "apps/api/dist/main.js"]
