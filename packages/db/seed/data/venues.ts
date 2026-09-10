import { PersonaKey } from '@prisma/client';

/**
 * Venues and programs harvested from the legacy `gigs: string[]` arrays.
 *
 * The legacy data was a flat list of strings mixing three different things:
 * venue names ("Pebbles Bangalore"), branded night names
 * ("Housefull Sunday - BigPitcher Sarjapur") and venue-plus-location
 * ("XU Fashion Bar Kitchen, Leela Palace Bangalore"). Splitting them into
 * Venue and Program rows is what turns them into a linkable, crawlable graph
 * with Place schema and per-venue landing pages.
 *
 * IMPORTANT: the legacy data carried no dates, ticket links or lineups, so
 * this file seeds no Event rows. Fabricating gig dates would be the same
 * mistake as the fabricated Berghain/Boom Festival testimonials on the old
 * site. Real events are entered in admin; `seed:demo` generates clearly
 * synthetic ones for local development.
 *
 * Coordinates are approximate venue-area centroids, adequate for a map pin
 * and for LocalBusiness/Place schema. They should be corrected in admin.
 *
 * See docs/07-content/legacy-audit.md
 */
export interface SeedVenue {
  slug: string;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
}

export const seedVenues: SeedVenue[] = [
  {
    slug: 'big-pitcher-sarjapur',
    name: 'Big Pitcher Sarjapur',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    latitude: 12.9121,
    longitude: 77.6446,
    notes:
      'Residency venue for the Housefull Sunday, Big Bollywood Night and Clubbers Friday nights.',
  },
  {
    slug: 'pebbles-bengaluru',
    name: 'Pebbles',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    latitude: 12.9857,
    longitude: 77.5954,
    notes: 'Open-air venue. Hosted both techno and psytrance sets.',
  },
  {
    slug: 'ashva-resto-hangouts',
    name: 'Ashva Resto Hangouts',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    latitude: 12.9698,
    longitude: 77.7499,
    notes: 'Home of the Bolly-Tech and Sonic Saturday nights.',
  },
  {
    slug: 'xu-leela-palace-bengaluru',
    name: 'XU Fashion Bar & Kitchen, The Leela Palace',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    latitude: 12.9606,
    longitude: 77.6476,
    notes: 'Luxury hotel club. Techno and psytrance sets.',
  },
  {
    slug: 'blr-brew-bengaluru',
    name: 'BLR Brew',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    latitude: 12.9784,
    longitude: 77.6408,
    notes: 'Brewpub. Psytrance and multi-genre duo sets.',
  },
  {
    slug: 'up-and-peace-himachal',
    name: 'Up and Peace',
    city: 'Kasol',
    state: 'Himachal Pradesh',
    country: 'India',
    latitude: 32.0107,
    longitude: 77.3152,
    notes: 'Mountain venue in the Parvati valley. Psytrance.',
  },
  {
    slug: 'pyramid-elante-chandigarh',
    name: 'Pyramid, Elante Mall',
    city: 'Chandigarh',
    state: 'Chandigarh',
    country: 'India',
    latitude: 30.7053,
    longitude: 76.8013,
    notes: 'Largest room played outside Bengaluru.',
  },
];

/**
 * Recurring and branded nights. These are the entries the legacy site
 * rendered as "Name - Venue" strings.
 */
export interface SeedProgram {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  cadence: string;
  personaKey: PersonaKey;
  venueSlug: string;
  isOngoing: boolean;
}

export const seedPrograms: SeedProgram[] = [
  {
    slug: 'bolly-tech',
    name: 'Bolly-Tech',
    subtitle: 'Bollywood meets tech house',
    description:
      'The night that defined the Bolly-Tech sound: Bollywood vocals and hooks rebuilt over tech-house and Afro-house grooves.',
    cadence: 'Recurring',
    personaKey: PersonaKey.FELICITOUS,
    venueSlug: 'ashva-resto-hangouts',
    isOngoing: true,
  },
  {
    slug: 'sonic-saturday',
    name: 'Sonic Saturday',
    subtitle: 'Weekend peak-time',
    description: 'Saturday-night commercial and house programming.',
    cadence: 'Weekly',
    personaKey: PersonaKey.FELICITOUS,
    venueSlug: 'ashva-resto-hangouts',
    isOngoing: true,
  },
  {
    slug: 'housefull-sunday',
    name: 'Housefull Sunday',
    subtitle: 'Sunday sessions',
    description: 'Sunday-evening Bollywood and commercial sets for a full-room crowd.',
    cadence: 'Weekly',
    personaKey: PersonaKey.FELICITOUS,
    venueSlug: 'big-pitcher-sarjapur',
    isOngoing: true,
  },
  {
    slug: 'big-bollywood-night',
    name: 'Big Bollywood Night',
    subtitle: 'All-Bollywood, all night',
    description: 'A full night of Bollywood across eras, from retro to current chart.',
    cadence: 'Recurring',
    personaKey: PersonaKey.FELICITOUS,
    venueSlug: 'big-pitcher-sarjapur',
    isOngoing: true,
  },
  {
    slug: 'wonder-woman',
    name: 'Wonder Woman',
    subtitle: 'Ladies night',
    description: 'Themed ladies-night programming with commercial and Bollywood sets.',
    cadence: 'Recurring',
    personaKey: PersonaKey.FELICITOUS,
    venueSlug: 'big-pitcher-sarjapur',
    isOngoing: false,
  },
  {
    slug: 'clubbers-friday',
    name: 'Clubbers Friday',
    subtitle: 'Friday openers',
    description: 'Friday-night commercial and house programming to open the weekend.',
    cadence: 'Weekly',
    personaKey: PersonaKey.FELICITOUS,
    venueSlug: 'big-pitcher-sarjapur',
    isOngoing: true,
  },
];

/**
 * Which personas have played which venues.
 *
 * Derived from the legacy per-persona `gigs` arrays. Used to seed the
 * "venues played" relation that drives the venue cloud and the gig map,
 * without asserting specific dates.
 */
export const seedPersonaVenues: Record<PersonaKey, string[]> = {
  [PersonaKey.COUPLE_DUO]: [
    'big-pitcher-sarjapur',
    'pebbles-bengaluru',
    'ashva-resto-hangouts',
    'xu-leela-palace-bengaluru',
    'blr-brew-bengaluru',
    'up-and-peace-himachal',
    'pyramid-elante-chandigarh',
  ],
  [PersonaKey.FELICITOUS]: ['ashva-resto-hangouts', 'big-pitcher-sarjapur'],
  [PersonaKey.TRINITROCOSMIC]: [
    'xu-leela-palace-bengaluru',
    'pebbles-bengaluru',
    'up-and-peace-himachal',
    'blr-brew-bengaluru',
  ],
  [PersonaKey.TNT]: ['pebbles-bengaluru', 'xu-leela-palace-bengaluru'],
};
