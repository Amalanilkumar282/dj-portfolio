import { GearCategory, ProficiencyLevel, ServiceCategory } from '@prisma/client';

/**
 * Site-wide content: settings singleton, genres, services, FAQs and gear.
 *
 * Contact details are carried over from the legacy site verbatim. Everything
 * commercial (prices, inclusions) is seeded as a documented placeholder for
 * the DJ to correct in admin — inventing his rates would be worse than
 * leaving them blank, and the `priceFrom`/`priceTo` nullability means
 * "On request" renders correctly until he fills them in.
 *
 * See docs/07-content/content-model-guide.md
 */

/** Contact details from the legacy site (typo "Banglore" corrected). */
export const seedSettings = {
  siteName: 'DJ Felicitous',
  siteTagline: 'One artist. Four sounds.',
  contactEmail: 'felicitousdj@gmail.com',
  bookingEmail: 'felicitousdj@gmail.com',
  contactPhone: '+919847352182',
  whatsappNumber: '919847352182',
  addressCity: 'Bengaluru',
  addressRegion: 'Karnataka',
  addressCountry: 'IN',
  latitude: 12.9716,
  longitude: 77.5946,
  serviceAreaText: 'Bengaluru, Karnataka and across India, plus destination events',
  defaultSeoTitle: 'DJ Felicitous — Multi-Genre DJ & Producer in Bengaluru',
  defaultSeoDescription:
    'Bengaluru-based DJ and producer working across Bollywood, commercial, techno and psytrance. Weddings, corporate events, clubs and festivals. Check availability.',
  twitterHandle: '@djfelicitous',
  defaultAccentColor: '#2DD4BF',
  responseTimePromise: 'Replies within 24 hours',
  // Blog and newsletter ship dark; they are switched on in later phases once
  // there is content to justify the routes existing in the sitemap.
  featureBlogEnabled: false,
  featureNewsletterEnabled: false,
  bookingFormEnabled: true,
};

/**
 * Canonical genre vocabulary.
 *
 * Drawn from the legacy hero chips plus the per-persona genre labels. Genres
 * are a controlled list rather than free tags so filters, JSON-LD `genre`
 * and the persona/track relations all agree.
 */
export const seedGenres: { slug: string; name: string }[] = [
  { slug: 'bollywood', name: 'Bollywood' },
  { slug: 'south-indian-hits', name: 'South Indian Hits' },
  { slug: 'bolly-tech', name: 'Bolly-Tech' },
  { slug: 'afro-bolly', name: 'Afro-Bolly' },
  { slug: 'commercial', name: 'Commercial' },
  { slug: 'deep-house', name: 'Deep House' },
  { slug: 'afro-house', name: 'Afro House' },
  { slug: 'tech-house', name: 'Tech House' },
  { slug: 'progressive-house', name: 'Progressive House' },
  { slug: 'electro-house', name: 'Electro House' },
  { slug: 'melodic-techno', name: 'Melodic Techno' },
  { slug: 'peak-time-techno', name: 'Peak Time Techno' },
  { slug: 'minimal', name: 'Minimal' },
  { slug: 'industrial-techno', name: 'Industrial Techno' },
  { slug: 'deep-techno', name: 'Deep Techno' },
  { slug: 'techno', name: 'Techno' },
  { slug: 'psytrance', name: 'Psytrance' },
  { slug: 'progressive-psytrance', name: 'Progressive Psytrance' },
  { slug: 'dark-psy', name: 'Dark Psy' },
  { slug: 'forest', name: 'Forest' },
  { slug: 'hi-tech', name: 'Hi-Tech' },
  { slug: 'psycore', name: 'Psycore' },
];

/**
 * Service packages.
 *
 * Prices are intentionally null: "On request" is the honest default and
 * `formatPriceRange` renders it. The inclusions are drawn from what the
 * legacy booking modal asked about (event type, duration, venue) plus the
 * add-ons standard for this market.
 */
export interface SeedService {
  slug: string;
  name: string;
  category: ServiceCategory;
  summary: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  addons: string[];
  durationHours: number | null;
}

export const seedServices: SeedService[] = [
  {
    slug: 'weddings',
    name: 'Weddings & Sangeet',
    category: ServiceCategory.WEDDING,
    summary:
      'Sangeet, mehendi, cocktail and reception — a music plan across the whole wedding, not just one night.',
    description:
      'Multi-event wedding coverage built around a timeline agreed in advance: entry sequences, family performances, first dance and the late-night dancefloor. Bollywood, South Indian, Punjabi and commercial, mixed live and read off the room.',
    inclusions: [
      'Planning call and event timeline',
      'Curated setlist with your must-play and do-not-play lists',
      'Entry and performance track edits',
      'Live mixing across the event',
      'MC coordination with your host or planner',
      'Backup laptop and controller on site',
    ],
    exclusions: ['Sound and lighting hire', 'Venue charges', 'Travel and stay outside Bengaluru'],
    addons: [
      'LED video wall',
      'Live saxophone',
      'Live dhol',
      'Percussion duo',
      'Cold sparklers',
      'CO2 jets',
      'Additional DJ for a parallel venue',
    ],
    durationHours: null,
  },
  {
    slug: 'corporate',
    name: 'Corporate & Brand Activations',
    category: ServiceCategory.CORPORATE,
    summary:
      'Annual days, product launches, offsites and brand activations, pitched to the room rather than the club.',
    description:
      'Programming that reads a corporate audience: background and cocktail-hour sets that stay conversational, building to a dancefloor only when the evening calls for it. Clean edits throughout.',
    inclusions: [
      'Brief call with the events team',
      'Clean-edit-only music policy',
      'Background, cocktail and peak-time programming',
      'Award and presentation stingers',
      'Live mixing',
    ],
    exclusions: ['AV and staging', 'Venue charges', 'Travel and stay outside Bengaluru'],
    addons: ['LED video wall', 'Live saxophone', 'Branded visual loops'],
    durationHours: 4,
  },
  {
    slug: 'clubs',
    name: 'Clubs & Nightlife',
    category: ServiceCategory.CLUB,
    summary: 'Guest and residency sets across Bollywood, commercial, house and techno.',
    description:
      'Club programming for any slot: warm-up, peak-time or closing. Bolly-Tech, Afro-Bolly, tech house and melodic techno depending on the room and the night.',
    inclusions: [
      'Slot-appropriate set design',
      'Live mixing on house equipment',
      'Social promotion of the date',
    ],
    exclusions: ['Equipment hire'],
    addons: ['Extended set', 'Back-to-back with a resident'],
    durationHours: 3,
  },
  {
    slug: 'private-parties',
    name: 'Private & House Parties',
    category: ServiceCategory.PRIVATE_PARTY,
    summary: 'Birthdays, anniversaries, housewarmings and terrace parties.',
    description:
      'Smaller-room sets where the guest list is mixed and the music has to work for everyone. Requests welcome and worked into the flow rather than played back to back.',
    inclusions: [
      'Pre-event music preferences form',
      'Live mixing',
      'Requests handled on the night',
      'Compact setup suitable for homes and terraces',
    ],
    exclusions: ['Sound hire', 'Travel outside Bengaluru'],
    addons: ['Compact PA and lighting package', 'Live saxophone'],
    durationHours: 4,
  },
  {
    slug: 'festivals',
    name: 'Festivals & Psytrance',
    category: ServiceCategory.FESTIVAL,
    summary: 'Psytrance and techno festival sets, from progressive through hi-tech and psycore.',
    description:
      'Festival and outdoor programming as Trinitrocosmic or TNT. Sets designed for the slot and the hour, whether that is a sunrise progressive set or a 3 AM hi-tech assault.',
    inclusions: [
      'Slot-specific set design',
      'Original productions in the set',
      'Technical rider supplied in advance',
    ],
    exclusions: ['Production and stage costs', 'Travel and accommodation'],
    addons: ['Extended sunrise set', 'Live visual collaboration'],
    durationHours: 2,
  },
  {
    slug: 'production',
    name: 'Production & Remixes',
    category: ServiceCategory.PRODUCTION,
    summary: 'Custom edits, wedding entry mixes, remixes and original production.',
    description:
      'Studio work: bespoke entry and performance edits for weddings, remixes of tracks you own the rights to, and original production.',
    inclusions: ['Brief and reference call', 'Two revision rounds', 'Mastered deliverable'],
    exclusions: ['Sample and master clearance', 'Distribution'],
    addons: ['Additional revision rounds', 'Stems delivery'],
    durationHours: null,
  },
];

/**
 * FAQs. Plain text answers only — FAQPage JSON-LD must not carry markup.
 */
export const seedFaqs: { slug: string; question: string; answer: string; category: string }[] = [
  {
    slug: 'how-far-in-advance-should-i-book',
    question: 'How far in advance should I book?',
    answer:
      'For weddings, three to six months is comfortable, and peak season dates go earlier than that. For clubs and private parties, two to four weeks is usually enough. If your date is close, ask anyway — it is worth checking.',
    category: 'booking',
  },
  {
    slug: 'what-does-it-cost',
    question: 'What does it cost?',
    answer:
      'It depends on the event type, the date, how many hours you need and whether equipment is included. Send the date and a short brief and you will get a specific quote rather than a range.',
    category: 'pricing',
  },
  {
    slug: 'do-you-travel-outside-bengaluru',
    question: 'Do you travel outside Bengaluru?',
    answer:
      'Yes. Destination weddings and out-of-state events are regular work, including Himachal Pradesh, Chandigarh and Goa. Travel and accommodation are quoted separately.',
    category: 'travel',
  },
  {
    slug: 'do-you-bring-sound-and-lighting',
    question: 'Do you bring your own sound and lighting?',
    answer:
      'The standard booking is the DJ performance on equipment provided at the venue. Sound, lighting and effects can be arranged as an add-on through trusted suppliers, quoted separately.',
    category: 'equipment',
  },
  {
    slug: 'what-equipment-do-you-need',
    question: 'What equipment do you need at the venue?',
    answer:
      'A Pioneer DJM mixer with two CDJs, or an XDJ all-in-one, plus a stable booth and monitors. The full technical rider is on the rider page and can be sent to your venue or sound supplier directly.',
    category: 'equipment',
  },
  {
    slug: 'can-we-give-you-a-playlist',
    question: 'Can we give you a playlist?',
    answer:
      'Yes, and it helps. A must-play list and a do-not-play list are both useful. They are treated as direction for the set rather than a fixed running order, so the room can still be read live.',
    category: 'music',
  },
  {
    slug: 'which-persona-should-we-book',
    question: 'There are four names. Which one do we book?',
    answer:
      'They are all the same artist, programmed for different rooms. DJ Felicitous is Bollywood and commercial, TNT is techno, Trinitrocosmic is psytrance, and DJ Felicitous & DJ Geetz is the couple duo. If you are not sure, describe the event and you will be pointed at the right one.',
    category: 'booking',
  },
  {
    slug: 'do-you-take-requests-on-the-night',
    question: 'Do you take requests on the night?',
    answer:
      'Yes, where they fit the moment. Requests that would empty the floor get held for a better point in the set rather than refused.',
    category: 'music',
  },
  {
    slug: 'what-happens-if-you-are-unavailable',
    question: 'What happens if something goes wrong on the day?',
    answer:
      'A backup laptop and controller come to every event. In the unlikely case of an emergency, a vetted replacement DJ from the network is arranged at no extra cost to you.',
    category: 'booking',
  },
  {
    slug: 'how-do-we-confirm-a-date',
    question: 'How do we confirm a date?',
    answer:
      'Send an enquiry with the date, then a short call to confirm the details. The date is held on an advance, with the balance due on or before the event.',
    category: 'booking',
  },
];

/**
 * Console and gear experience.
 *
 * Doubles as the source for the technical rider, so equipment lives in one
 * place. `isRiderItem` controls what appears on /rider.
 */
export interface SeedGear {
  slug: string;
  category: GearCategory;
  brand: string;
  model: string;
  proficiency: ProficiencyLevel;
  isRiderItem: boolean;
  isPreferred: boolean;
  notes: string;
}

export const seedGear: SeedGear[] = [
  {
    slug: 'pioneer-djm-a9',
    category: GearCategory.MIXER,
    brand: 'Pioneer DJ',
    model: 'DJM-A9',
    proficiency: ProficiencyLevel.EXPERT,
    isRiderItem: true,
    isPreferred: true,
    notes: 'Preferred mixer. DJM-900NXS2 is an accepted alternative.',
  },
  {
    slug: 'pioneer-djm-900nxs2',
    category: GearCategory.MIXER,
    brand: 'Pioneer DJ',
    model: 'DJM-900NXS2',
    proficiency: ProficiencyLevel.EXPERT,
    isRiderItem: true,
    isPreferred: false,
    notes: 'Accepted alternative to the DJM-A9.',
  },
  {
    slug: 'pioneer-cdj-3000',
    category: GearCategory.CDJ,
    brand: 'Pioneer DJ',
    model: 'CDJ-3000',
    proficiency: ProficiencyLevel.EXPERT,
    isRiderItem: true,
    isPreferred: true,
    notes: 'Two units required, linked. CDJ-2000NXS2 accepted.',
  },
  {
    slug: 'pioneer-cdj-2000nxs2',
    category: GearCategory.CDJ,
    brand: 'Pioneer DJ',
    model: 'CDJ-2000NXS2',
    proficiency: ProficiencyLevel.EXPERT,
    isRiderItem: true,
    isPreferred: false,
    notes: 'Accepted alternative. Two units, linked.',
  },
  {
    slug: 'pioneer-xdj-xz',
    category: GearCategory.CONTROLLER,
    brand: 'Pioneer DJ',
    model: 'XDJ-XZ',
    proficiency: ProficiencyLevel.ADVANCED,
    isRiderItem: true,
    isPreferred: false,
    notes: 'All-in-one alternative for smaller rooms and private events.',
  },
  {
    slug: 'pioneer-ddj-flx6',
    category: GearCategory.CONTROLLER,
    brand: 'Pioneer DJ',
    model: 'DDJ-FLX6',
    proficiency: ProficiencyLevel.ADVANCED,
    isRiderItem: false,
    isPreferred: false,
    notes: 'Backup controller carried to every event.',
  },
  {
    slug: 'rekordbox',
    category: GearCategory.SOFTWARE,
    brand: 'Pioneer DJ',
    model: 'rekordbox',
    proficiency: ProficiencyLevel.EXPERT,
    isRiderItem: false,
    isPreferred: true,
    notes: 'Primary library and export workflow. USB and laptop playback both supported.',
  },
  {
    slug: 'ableton-live',
    category: GearCategory.DAW,
    brand: 'Ableton',
    model: 'Live',
    proficiency: ProficiencyLevel.ADVANCED,
    isRiderItem: false,
    isPreferred: true,
    notes: 'Production, remixes and custom wedding entry edits.',
  },
  {
    slug: 'fl-studio',
    category: GearCategory.DAW,
    brand: 'Image-Line',
    model: 'FL Studio',
    proficiency: ProficiencyLevel.PROFICIENT,
    isRiderItem: false,
    isPreferred: false,
    notes: 'Used for psytrance production.',
  },
  {
    slug: 'pioneer-monitors',
    category: GearCategory.MONITOR,
    brand: 'Pioneer DJ',
    model: 'Booth monitors',
    proficiency: ProficiencyLevel.EXPERT,
    isRiderItem: true,
    isPreferred: true,
    notes: 'Two booth monitors on independent send, positioned at ear height.',
  },
  {
    slug: 'shure-sm58',
    category: GearCategory.MICROPHONE,
    brand: 'Shure',
    model: 'SM58',
    proficiency: ProficiencyLevel.PROFICIENT,
    isRiderItem: true,
    isPreferred: true,
    notes: 'One wireless handheld at the booth for announcements.',
  },
];
