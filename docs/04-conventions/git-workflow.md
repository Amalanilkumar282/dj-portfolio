# Git workflow and commit conventions

## Branches

`main` is always deployable and protected: PR required, CI must pass, no force
push.

```
feat/persona-page          new feature
fix/booking-email-retry    bug fix
chore/upgrade-prisma       maintenance
docs/phase-3-notes         documentation
refactor/events-repository restructuring
```

One phase does not have to be one branch. Prefer small PRs that each leave
`main` working over one PR that completes a whole phase.

## Commits — Conventional Commits

Enforced by `commitlint` on `commit-msg`.

```
<type>(<scope>): <subject>

[body]

[footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

**Scopes:** `db`, `api`, `web`, `admin`, `ui`, `contracts`, `motion`, `media`,
`seo`, `utils`, `docs`, `ci`, `deps`.

```
feat(db): add Playlist and PlaylistTrack models
fix(api): retry booking notification when Resend returns 5xx
perf(web): share the three.js chunk across shader, turntable and globe
docs(db): explain the lazy PrismaPromise audit-stamping trap
```

Subject: imperative, lower case, no trailing full stop, ≤72 characters.

Use the body to say **why**, not what — the diff already says what. A breaking
change gets a `BREAKING CHANGE:` footer.

## Hooks (Husky)

| Hook         | Runs                                                            |
| ------------ | --------------------------------------------------------------- |
| `pre-commit` | lint-staged: `eslint --fix`, `prettier --write`, related Vitest |
| `commit-msg` | commitlint                                                      |
| `pre-push`   | `turbo typecheck`                                               |

**Never `--no-verify`.** If a hook is in the way, the hook found something. The
one legitimate exception is a merge commit that trips commitlint.

## Pull requests

Include:

- What changed and **why**
- The phase and exit criteria it advances
- How it was verified — commands run, what passed
- What was **not** verified, and why
- Screenshots for visual changes, including a reduced-motion capture for motion
  work

Required checks: lint, typecheck, test, build, `db:migrate:check`, Playwright,
axe, Lighthouse budgets, `size-limit`.

## Migrations in review

Treat a migration as the highest-risk file in any PR.

- Is it reversible, or is it expand/contract across two deploys?
- Does it lock a large table?
- Does `db:migrate:check` report no drift?
- If it touches >1000 rows, is the data migration a separate `-- @manual`
  script rather than inline DDL?

See [`../05-operations/migrations.md`](../05-operations/migrations.md).

## Releases

`main` deploys automatically: Vercel builds `web` and `admin` (gated by
`turbo-ignore`), Railway builds the API and runs `migrate deploy`,
`post-migrate` and `seed:system` as a pre-deploy command.

`packages/*` are versioned with Changesets. They are internal, so this matters
mainly for a readable changelog.

## Notes for AI agents

- **Do not commit unless asked.** The user manages version control on this
  project.
- Do not `git init` or add a remote unprompted.
- If asked to commit, follow the conventions above and use the attribution
  footer the session specifies.
- Never rewrite published history.
