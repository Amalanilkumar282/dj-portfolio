# Architecture decision records

One file per decision. Numbered, and **immutable once accepted** — if a
decision turns out to be wrong, write a new ADR that supersedes it rather than
editing history. That way a future reader can tell the difference between "we
considered this and chose otherwise" and "nobody thought about it".

Format: Context → Decision → Consequences → Alternatives rejected.

| #                                                         | Decision                                           | Status   |
| --------------------------------------------------------- | -------------------------------------------------- | -------- |
| [0001](0001-monorepo-turborepo.md)                        | pnpm + Turborepo monorepo                          | Accepted |
| [0002](0002-separate-admin-app.md)                        | Admin is a separate Next.js app                    | Accepted |
| [0003](0003-nestjs-hand-rolled-auth.md)                   | Hand-rolled auth in NestJS                         | Accepted |
| [0004](0004-zod-contracts-over-openapi-codegen.md)        | Zod contracts, not OpenAPI codegen                 | Accepted |
| [0005](0005-neon-pooled-no-accelerate.md)                 | Pooled Neon, no Accelerate or serverless driver    | Accepted |
| [0006](0006-no-redis-at-launch.md)                        | No Redis at launch                                 | Accepted |
| [0007](0007-railway-for-api.md)                           | Railway hosts the API                              | Accepted |
| [0008](0008-cloudinary-signed-direct-upload.md)           | Signed direct browser uploads to Cloudinary        | Accepted |
| [0009](0009-persona-dynamic-route.md)                     | Personas are a dynamic route, not four static ones | Accepted |
| [0010](0010-tiptap-json-storage.md)                       | Rich text stored as Tiptap JSON, never HTML        | Accepted |
| [0011](0011-react-pdf-over-puppeteer.md)                  | React-PDF for the press kit, not Puppeteer         | Accepted |
| [0012](0012-radix-vendored-shadcn.md)                     | Radix behaviour, vendored shadcn source            | Accepted |
| [0013](0013-cinematic-video-with-motiongate-fallbacks.md) | Cinematic video and 3D behind MotionGate           | Accepted |
| [0014](0014-camelcase-columns.md)                         | Prisma-default camelCase columns                   | Accepted |
| [0015](0015-post-migrate-sql-outside-migrations.md)       | Non-expressible DDL outside prisma/migrations      | Accepted |
