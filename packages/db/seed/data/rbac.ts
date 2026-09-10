/**
 * Roles and permissions.
 *
 * Seeded by `seed:system`, which runs in every environment including
 * production, and is idempotent (upsert on the natural key).
 *
 * Permission keys are `resource:action`. The API enforces them with
 * `@RequirePermissions('event:publish')`; the admin UI renders its navigation
 * from the session permission set server-side rather than hiding items with
 * CSS.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */

/** Every resource that has admin endpoints. */
export const RESOURCES = [
  'persona',
  'genre',
  'track',
  'playlist',
  'release',
  'event',
  'venue',
  'program',
  'media',
  'gallery',
  'video',
  'testimonial',
  'brand',
  'stat',
  'service',
  'faq',
  'pressAsset',
  'gear',
  'experience',
  'post',
  'tag',
  'staticPage',
  'inquiry',
  'newsletter',
  'settings',
  'redirect',
  'user',
  'role',
  'auditLog',
  'analytics',
] as const;

export type Resource = (typeof RESOURCES)[number];

/**
 * `read` covers list and detail. `write` covers create and update. `publish`
 * is separate from `write` deliberately: an editor may draft freely while
 * only the owner decides what goes live.
 */
export const ACTIONS = ['read', 'write', 'delete', 'publish'] as const;
export type Action = (typeof ACTIONS)[number];

/** Resources where publish is meaningless (no ContentStatus column). */
const NON_PUBLISHABLE: ReadonlySet<Resource> = new Set([
  'genre',
  'media',
  'stat',
  'tag',
  'inquiry',
  'newsletter',
  'settings',
  'redirect',
  'user',
  'role',
  'auditLog',
  'analytics',
]);

/** Resources that are read-only through the API (written by the system). */
const READ_ONLY: ReadonlySet<Resource> = new Set(['auditLog', 'analytics']);

export interface SeedPermission {
  key: string;
  resource: Resource;
  action: Action;
}

export const seedPermissions: SeedPermission[] = RESOURCES.flatMap((resource) =>
  ACTIONS.filter((action) => {
    if (READ_ONLY.has(resource)) return action === 'read';
    if (action === 'publish') return !NON_PUBLISHABLE.has(resource);
    return true;
  }).map((action) => ({ key: `${resource}:${action}`, resource, action })),
);

export interface SeedRole {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  /** `'*'` grants every permission. */
  permissions: '*' | string[];
}

export const seedRoles: SeedRole[] = [
  {
    key: 'SUPER_ADMIN',
    name: 'Owner',
    description:
      'Full access, including users, roles and site settings. TOTP two-factor is mandatory for this role.',
    isSystem: true,
    permissions: '*',
  },
  {
    key: 'EDITOR',
    name: 'Editor',
    description:
      'Manages and publishes content and handles booking enquiries. Cannot change users, roles, settings or redirects.',
    isSystem: true,
    permissions: seedPermissions
      .filter(
        (p) =>
          !['user', 'role', 'settings', 'redirect'].includes(p.resource) &&
          // Deleting media is destructive and cascades to published pages.
          !(p.resource === 'media' && p.action === 'delete'),
      )
      .map((p) => p.key),
  },
  {
    key: 'VIEWER',
    name: 'Viewer',
    description:
      'Read-only access to content and enquiries. Useful for a manager or collaborator who needs visibility but not control.',
    isSystem: true,
    permissions: seedPermissions
      .filter((p) => p.action === 'read' && !['user', 'role'].includes(p.resource))
      .map((p) => p.key),
  },
];
