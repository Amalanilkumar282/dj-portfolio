/**
 * Config-driven CRUD, generalising the Venues screen (Group E's first
 * pass) to every taxonomy/simple-content model in one shot. See
 * `components/generic/entity-list.tsx` and `entity-form.tsx` — this file
 * only ever adds data, never new component logic, so a new content type
 * is a config entry, not a new screen to write and re-test.
 *
 * Deliberately excluded (see STATUS.md's Group E "next pass" section for
 * why): Personas, Tracks, Releases, Playlists, Programs, Events — each
 * needs media/relation pickers (artwork, genres, lineup, track ordering)
 * that a generic scalar-field form cannot represent; shipping a form that
 * silently can't set a track's audio or a persona's hero image would be
 * actively misleading, not merely incomplete.
 */

export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'date';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  required?: boolean;
  helpText?: string;
}

export interface ListColumn {
  key: string;
  label: string;
}

export interface EntityConfig {
  key: string;
  label: string;
  pluralLabel: string;
  /** API path under `/api/v1`, e.g. `admin/testimonials`. */
  basePath: string;
  /** Admin UI path, e.g. `/testimonials`. */
  adminRoute: string;
  /** e.g. `testimonial` — permissions are `${permissionPrefix}:read` etc. */
  permissionPrefix: string;
  /** Publishable models get publish/unpublish actions; taxonomy models don't. */
  publishable: boolean;
  /** Taxonomy lists (Tags) return a bare `{ data }`, not offset pagination meta. */
  paginated: boolean;
  /**
   * Has a `PATCH {basePath}/reorder` route. Exposed as explicit "Move up" /
   * "Move down" buttons — not drag-and-drop — which is also the required
   * accessible alternative under WCAG 2.5.7, not a lesser stand-in for it.
   */
  reorderable: boolean;
  fields: FieldSpec[];
  listColumns: ListColumn[];
}

const PERSONA_OPTIONS: SelectOption[] = [
  { value: '', label: '— none —' },
  { value: 'FELICITOUS', label: 'Felicitous' },
  { value: 'TRINITROCOSMIC', label: 'Trinitrocosmic' },
  { value: 'TNT', label: 'TNT' },
  { value: 'COUPLE_DUO', label: 'Felicitous x Geetz' },
];

export const ENTITIES: EntityConfig[] = [
  {
    key: 'genres',
    label: 'Genre',
    pluralLabel: 'Genres',
    basePath: 'admin/genres',
    adminRoute: '/genres',
    permissionPrefix: 'genre',
    publishable: false,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'colorHex', label: 'Color (hex code, with the # — e.g. from a color picker)', type: 'text' },
    ],
    listColumns: [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
    ],
  },
  {
    key: 'tags',
    label: 'Tag',
    pluralLabel: 'Tags',
    basePath: 'admin/tags',
    adminRoute: '/tags',
    permissionPrefix: 'tag',
    publishable: false,
    paginated: false,
    reorderable: false,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    listColumns: [
      { key: 'name', label: 'Name' },
      { key: 'postCount', label: 'Posts' },
    ],
  },
  {
    key: 'stats',
    label: 'Stat',
    pluralLabel: 'Stats',
    basePath: 'admin/stats',
    adminRoute: '/stats',
    permissionPrefix: 'stat',
    publishable: false,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'key', label: 'Key (snake_case)', type: 'text', required: true, helpText: 'e.g. gigs_played' },
      { name: 'label', label: 'Label', type: 'text', required: true },
      { name: 'value', label: 'Value (as displayed, e.g. 10M+)', type: 'text', required: true },
      { name: 'numericValue', label: 'Numeric value (animation target)', type: 'number' },
      { name: 'suffix', label: 'Suffix', type: 'text' },
      { name: 'personaKey', label: 'Persona', type: 'select', options: PERSONA_OPTIONS },
      { name: 'isVisible', label: 'Visible', type: 'boolean' },
    ],
    listColumns: [
      { key: 'label', label: 'Label' },
      { key: 'value', label: 'Value' },
      { key: 'isVisible', label: 'Visible' },
    ],
  },
  {
    key: 'redirects',
    label: 'Redirect',
    pluralLabel: 'Redirects',
    basePath: 'admin/redirects',
    adminRoute: '/redirects',
    permissionPrefix: 'redirect',
    publishable: false,
    paginated: true,
    reorderable: false,
    fields: [
      { name: 'fromPath', label: 'From path', type: 'text', required: true, helpText: 'Must start with /' },
      { name: 'toPath', label: 'To path', type: 'text', required: true },
      {
        name: 'kind',
        label: 'Kind',
        type: 'select',
        options: [
          { value: 'PERMANENT', label: 'Permanent (301)' },
          { value: 'TEMPORARY', label: 'Temporary (302)' },
        ],
      },
      { name: 'isActive', label: 'Active', type: 'boolean' },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    listColumns: [
      { key: 'fromPath', label: 'From' },
      { key: 'toPath', label: 'To' },
      { key: 'hitCount', label: 'Hits' },
    ],
  },
  {
    key: 'testimonials',
    label: 'Testimonial',
    pluralLabel: 'Testimonials',
    basePath: 'admin/testimonials',
    adminRoute: '/testimonials',
    permissionPrefix: 'testimonial',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'authorName', label: 'Author name', type: 'text', required: true },
      { name: 'authorRole', label: 'Author role', type: 'text' },
      { name: 'venueOrEvent', label: 'Venue or event', type: 'text' },
      { name: 'quote', label: 'Quote', type: 'textarea', required: true },
      { name: 'rating', label: 'Rating (1-5)', type: 'number' },
      { name: 'personaKey', label: 'Persona', type: 'select', options: PERSONA_OPTIONS },
      {
        name: 'isVerified',
        label: 'Verified (required before Review/AggregateRating JSON-LD is emitted)',
        type: 'boolean',
      },
      { name: 'isFeatured', label: 'Featured', type: 'boolean' },
    ],
    listColumns: [
      { key: 'authorName', label: 'Author' },
      { key: 'quote', label: 'Quote' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'services',
    label: 'Service',
    pluralLabel: 'Services',
    basePath: 'admin/services',
    adminRoute: '/services',
    permissionPrefix: 'service',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: [
          { value: 'WEDDING', label: 'Wedding' },
          { value: 'CORPORATE', label: 'Corporate' },
          { value: 'CLUB', label: 'Club' },
          { value: 'FESTIVAL', label: 'Festival' },
          { value: 'PRIVATE_PARTY', label: 'Private party' },
          { value: 'PRODUCTION', label: 'Production' },
        ],
      },
      { name: 'summary', label: 'Summary', type: 'textarea' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'durationHours', label: 'Duration (hours)', type: 'number' },
      { name: 'priceFrom', label: 'Price from (₹)', type: 'number' },
      { name: 'priceTo', label: 'Price to (₹)', type: 'number' },
      { name: 'personaKey', label: 'Persona', type: 'select', options: PERSONA_OPTIONS },
      { name: 'isFeatured', label: 'Featured', type: 'boolean' },
    ],
    listColumns: [
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'faqs',
    label: 'FAQ',
    pluralLabel: 'FAQs',
    basePath: 'admin/faqs',
    adminRoute: '/faqs',
    permissionPrefix: 'faq',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'question', label: 'Question', type: 'text', required: true },
      { name: 'answer', label: 'Answer', type: 'textarea', required: true },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'personaKey', label: 'Persona', type: 'select', options: PERSONA_OPTIONS },
    ],
    listColumns: [
      { key: 'question', label: 'Question' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'experience',
    label: 'Experience entry',
    pluralLabel: 'Experience',
    basePath: 'admin/experience',
    adminRoute: '/experience',
    permissionPrefix: 'experience',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'role', label: 'Role', type: 'text', required: true },
      { name: 'organisation', label: 'Organisation', type: 'text', required: true },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'startDate', label: 'Start date', type: 'date', required: true },
      { name: 'endDate', label: 'End date', type: 'date' },
      { name: 'isCurrent', label: 'Current', type: 'boolean' },
      { name: 'summary', label: 'Summary', type: 'textarea' },
    ],
    listColumns: [
      { key: 'role', label: 'Role' },
      { key: 'organisation', label: 'Organisation' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'brands',
    label: 'Brand',
    pluralLabel: 'Brands',
    basePath: 'admin/brands',
    adminRoute: '/brands',
    permissionPrefix: 'brand',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'websiteUrl', label: 'Website', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'isFeatured', label: 'Featured', type: 'boolean' },
    ],
    listColumns: [
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'gear',
    label: 'Gear item',
    pluralLabel: 'Gear',
    basePath: 'admin/gear',
    adminRoute: '/gear',
    permissionPrefix: 'gear',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'brand', label: 'Brand', type: 'text', required: true },
      { name: 'model', label: 'Model', type: 'text', required: true },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: [
          'MIXER',
          'CDJ',
          'CONTROLLER',
          'TURNTABLE',
          'DAW',
          'MONITOR',
          'SOFTWARE',
          'OUTBOARD',
          'MICROPHONE',
          'LIGHTING',
        ].map((v) => ({ value: v, label: v })),
      },
      {
        name: 'proficiency',
        label: 'Proficiency',
        type: 'select',
        options: ['FAMILIAR', 'PROFICIENT', 'ADVANCED', 'EXPERT'].map((v) => ({ value: v, label: v })),
      },
      { name: 'yearsUsed', label: 'Years used', type: 'number' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      { name: 'isRiderItem', label: 'On the tech rider', type: 'boolean' },
      { name: 'isPreferred', label: 'Preferred', type: 'boolean' },
    ],
    listColumns: [
      { key: 'brand', label: 'Brand' },
      { key: 'model', label: 'Model' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'press-kit',
    label: 'Press asset',
    pluralLabel: 'Press assets',
    basePath: 'admin/press-kit',
    adminRoute: '/press-assets',
    permissionPrefix: 'pressAsset',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'kind',
        label: 'Kind',
        type: 'select',
        required: true,
        options: [
          'LOGO_PACK',
          'LOGO_SVG',
          'HI_RES_PHOTO',
          'TECH_RIDER',
          'STAGE_PLOT',
          'BIO_PDF',
          'EPK_PDF',
          'RIDER_HOSPITALITY',
        ].map((v) => ({ value: v, label: v })),
      },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'personaKey', label: 'Persona', type: 'select', options: PERSONA_OPTIONS },
      { name: 'requiresEmail', label: 'Requires email to download', type: 'boolean' },
    ],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'kind', label: 'Kind' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'personas',
    label: 'Persona',
    pluralLabel: 'Personas',
    basePath: 'admin/personas',
    adminRoute: '/personas',
    permissionPrefix: 'persona',
    publishable: true,
    paginated: true,
    reorderable: true,
    // Unused — Persona gets a dedicated form (relation pickers: genres, hero/avatar media).
    fields: [],
    listColumns: [
      { key: 'stageName', label: 'Stage name' },
      { key: 'key', label: 'Key' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'tracks',
    label: 'Track',
    pluralLabel: 'Tracks',
    basePath: 'admin/tracks',
    adminRoute: '/tracks',
    permissionPrefix: 'track',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'artistLabel', label: 'Artist' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'releases',
    label: 'Release',
    pluralLabel: 'Releases',
    basePath: 'admin/releases',
    adminRoute: '/releases',
    permissionPrefix: 'release',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'playlists',
    label: 'Playlist',
    pluralLabel: 'Playlists',
    basePath: 'admin/playlists',
    adminRoute: '/playlists',
    permissionPrefix: 'playlist',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'trackCount', label: 'Tracks' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'galleries',
    label: 'Gallery',
    pluralLabel: 'Galleries',
    basePath: 'admin/galleries',
    adminRoute: '/galleries',
    permissionPrefix: 'gallery',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'itemCount', label: 'Images' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    // List-only config: the form is bespoke (components/videos/video-form.tsx)
    // because it needs the provider switch, a media picker for the thumbnail
    // and persona/event selects - none of which the generic scalar form can
    // render.
    key: 'videos',
    label: 'Video',
    pluralLabel: 'Videos',
    basePath: 'admin/videos',
    adminRoute: '/videos',
    permissionPrefix: 'video',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'provider', label: 'Provider' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'programs',
    label: 'Program',
    pluralLabel: 'Programs',
    basePath: 'admin/programs',
    adminRoute: '/programs',
    permissionPrefix: 'program',
    publishable: true,
    paginated: true,
    reorderable: true,
    fields: [],
    listColumns: [
      { key: 'name', label: 'Name' },
      { key: 'venueName', label: 'Venue' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'events',
    label: 'Event',
    pluralLabel: 'Events',
    basePath: 'admin/events',
    adminRoute: '/events',
    permissionPrefix: 'event',
    publishable: true,
    paginated: true,
    reorderable: false,
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'venueName', label: 'Venue' },
      { key: 'startsAt', label: 'Starts' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'pages',
    label: 'Page',
    pluralLabel: 'Static pages',
    basePath: 'admin/pages',
    adminRoute: '/pages',
    permissionPrefix: 'staticPage',
    publishable: true,
    paginated: true,
    reorderable: false,
    // Unused: StaticPage has its own dedicated Tiptap-powered form
    // (components/static-page-form.tsx) rather than the generic scalar
    // form — content is rich text, not a plain field.
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'slug', label: 'Slug' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'posts',
    label: 'Post',
    pluralLabel: 'Blog posts',
    basePath: 'admin/posts',
    adminRoute: '/posts',
    permissionPrefix: 'post',
    publishable: true,
    paginated: true,
    reorderable: false,
    // Unused — see 'pages' above; Post also gets a dedicated Tiptap form.
    fields: [],
    listColumns: [
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
    ],
  },
];

export function getEntityConfig(key: string): EntityConfig {
  const config = ENTITIES.find((entity) => entity.key === key);
  if (!config) throw new Error(`Unknown entity config: ${key}`);
  return config;
}
