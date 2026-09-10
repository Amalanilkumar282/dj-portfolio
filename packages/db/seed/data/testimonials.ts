import { PersonaKey } from '@prisma/client';

/**
 * Testimonials harvested from the legacy site.
 *
 * ONLY the eight private-event testimonials from `djProfiles.ts` are carried
 * over. The legacy persona pages additionally hardcoded testimonials
 * attributed to Boom Festival, Ozora Festival, Rainbow Serpent, Berghain,
 * Fabric and Tresor — the DJ has not played any of those, and the quotes were
 * invented. Those are deliberately NOT migrated:
 *
 *   1. It is a false claim to prospective clients.
 *   2. Emitting Review / AggregateRating JSON-LD over fabricated reviews is
 *      an explicit Google structured-data violation.
 *
 * Even the eight below are seeded with `isVerified: false`, so no Review
 * markup is emitted until the DJ confirms each one. See the `isVerified` gate
 * in the Testimonial model.
 *
 * See docs/07-content/legacy-audit.md and docs/07-content/brand.md
 */
export interface SeedTestimonial {
  authorName: string;
  venueOrEvent: string;
  quote: string;
  personaKey: PersonaKey;
}

export const seedTestimonials: SeedTestimonial[] = [
  {
    authorName: 'Rajesh Kumar',
    venueOrEvent: 'Private anniversary celebration',
    quote:
      'They made our anniversary party absolutely unforgettable. Everyone was dancing till 3 AM.',
    personaKey: PersonaKey.COUPLE_DUO,
  },
  {
    authorName: 'Priya Menon',
    venueOrEvent: 'Private birthday party',
    quote:
      'Best DJ duo we have ever hired. They perfectly balanced our multicultural guest list with an amazing music selection.',
    personaKey: PersonaKey.COUPLE_DUO,
  },
  {
    authorName: 'Ankit Sharma',
    venueOrEvent: 'Private housewarming party',
    quote:
      'DJ Felicitous made our family function absolutely spectacular. A perfect mix of Bollywood classics and modern hits.',
    personaKey: PersonaKey.FELICITOUS,
  },
  {
    authorName: 'Sneha Reddy',
    venueOrEvent: 'Private engagement celebration',
    quote:
      'Incredible energy and music selection. Our guests are still talking about how amazing the party was.',
    personaKey: PersonaKey.FELICITOUS,
  },
  {
    authorName: 'Rahul Agarwal',
    venueOrEvent: 'Private retreat celebration',
    quote:
      'Trinitrocosmic took us on an incredible psychedelic journey. Perfect for our retreat after-party.',
    personaKey: PersonaKey.TRINITROCOSMIC,
  },
  {
    authorName: 'Ishita Joshi',
    venueOrEvent: 'Private gathering',
    quote:
      'Mind-blowing experience. The cosmic vibes were exactly what we needed for our gathering.',
    personaKey: PersonaKey.TRINITROCOSMIC,
  },
  {
    authorName: 'Karan Bansal',
    venueOrEvent: 'Private corporate event',
    quote:
      'TNT brought raw underground energy to our corporate after-party. The techno had everyone moving.',
    personaKey: PersonaKey.TNT,
  },
  {
    authorName: 'Riya Iyer',
    venueOrEvent: 'Private house party',
    quote:
      'Absolutely incredible. The industrial techno vibe was perfect for our late-night celebration.',
    personaKey: PersonaKey.TNT,
  },
];
