import { PersonaKey, TrackType } from '@prisma/client';

import { durationToSeconds } from '@dj/utils';

/**
 * Track content harvested from the legacy static site
 * (djfelicitous/src/data/discography.ts) before that directory was deleted.
 *
 * All 20 SoundCloud track ids are real and preserved. Deliberate changes:
 *  - `duration: 'N/A'` becomes null; real values are parsed to integer
 *    seconds so playlists can be totalled and ISO-8601 emitted for JSON-LD.
 *  - `albumArt` pointed at /images/tracks/*.jpg, a directory that never
 *    existed — all 20 were broken. Dropped; artwork is attached in admin.
 *  - `artist` strings were inconsistent ("DJ FELICITOUS", "Felicitous",
 *    "Trinitrocosmic/DJ Felicitous"). Normalised into a persona key plus an
 *    `artistLabel` display credit.
 *  - `plays`/`likes` are kept but flagged: they are hand-typed, not live.
 *    Phase 13 syncs real counts from the SoundCloud API.
 *  - Titles carried BPM inline ("... | 180 BPM"); extracted into `bpm`.
 *
 * See docs/07-content/legacy-audit.md
 */
export interface SeedTrack {
  slug: string;
  title: string;
  artistLabel: string;
  personaKey: PersonaKey;
  type: TrackType;
  genreLabels: string[];
  description: string;
  bpm: number | null;
  durationSec: number | null;
  releaseYear: number;
  soundcloudTrackId: string;
  soundcloudUrl: string;
  isFeatured: boolean;
  tags: string[];
  /** Hand-curated legacy figures, not live platform counts. */
  playCount: number;
  likeCount: number;
}

const sc = (id: string) =>
  `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/${id}` +
  '&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true' +
  '&show_user=true&show_reposts=false&show_teaser=true';

/** Embed URL builder, exported so the seed does not duplicate the format. */
export const soundcloudEmbedUrl = sc;

export const seedTracks: SeedTrack[] = [
  // ---------------------------------------------------------------- original
  {
    slug: 'trinetra-awakening',
    title: 'Trinetra Awakening',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.ORIGINAL,
    genreLabels: ['Psytrance'],
    description:
      'An original 180 BPM psytrance production exploring the awakening of third-eye consciousness.',
    bpm: 180,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '2151283356',
    soundcloudUrl: 'https://soundcloud.com/trinitrocosmic/trinetra-awakening-trinitrocosmic180-bpm',
    isFeatured: true,
    tags: ['Psytrance', 'Original', 'Spiritual', 'Awakening'],
    playCount: 2850,
    likeCount: 245,
  },

  // ------------------------------------------------------------------ remixes
  {
    slug: 'gitanjali-book-of-poems-melodic-remix',
    title: 'Gitanjali — Book of Poems (Melodic Remix)',
    artistLabel: 'DJ Felicitous',
    personaKey: PersonaKey.FELICITOUS,
    type: TrackType.REMIX,
    genreLabels: ['Melodic Techno'],
    description: 'A melodic remix of classical poetry transformed into electronic soundscapes.',
    bpm: null,
    durationSec: null,
    releaseYear: 2023,
    soundcloudTrackId: '1426042222',
    soundcloudUrl: 'https://soundcloud.com/djfelicitous/gitanjali_book_of_poems',
    isFeatured: false,
    tags: ['Melodic', 'Remix', 'Poetry', 'Classical'],
    playCount: 1650,
    likeCount: 128,
  },
  {
    slug: 'neeye-melodic-remix',
    title: 'Neeye (Melodic Remix)',
    artistLabel: 'DJ Felicitous',
    personaKey: PersonaKey.FELICITOUS,
    type: TrackType.REMIX,
    genreLabels: ['Melodic Techno', 'South Indian Hits'],
    description:
      'A modern melodic remix bringing contemporary electronic elements to traditional melodies.',
    bpm: null,
    durationSec: null,
    releaseYear: 2025,
    soundcloudTrackId: '2154192126',
    soundcloudUrl: 'https://soundcloud.com/dj-felicitous/neeye-melodic-remix-2025dj-felicitous',
    isFeatured: true,
    tags: ['Melodic', 'Remix', 'Contemporary', 'Traditional'],
    playCount: 3420,
    likeCount: 289,
  },
  {
    slug: 'cosmic-tatvamasi',
    title: 'Cosmic Tatvamasi',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.REMIX,
    genreLabels: ['Psytrance'],
    description:
      'A cosmic interpretation of ancient philosophical concepts through electronic music.',
    bpm: null,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '2154165795',
    soundcloudUrl: 'https://soundcloud.com/trinitrocosmic/cosmic-tatvamasitrinitrocosmic',
    isFeatured: false,
    tags: ['Cosmic', 'Remix', 'Philosophy', 'Spiritual'],
    playCount: 2180,
    likeCount: 156,
  },
  {
    slug: 'cosmic-violin',
    title: 'Cosmic Violin',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.REMIX,
    genreLabels: ['Psytrance'],
    description:
      'A cosmic remix featuring ethereal violin melodies blended with electronic textures.',
    bpm: null,
    durationSec: null,
    releaseYear: 2023,
    soundcloudTrackId: '1450480204',
    soundcloudUrl: 'https://soundcloud.com/trinitrocosmic/cosmic-violin',
    isFeatured: false,
    tags: ['Cosmic', 'Remix', 'Violin', 'Ethereal'],
    playCount: 1890,
    likeCount: 142,
  },
  {
    slug: 'the-soul-seeker',
    title: 'The Soul Seeker',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.REMIX,
    genreLabels: ['Hi-Tech'],
    description:
      'A high-energy 210 BPM remix exploring the depths of consciousness and soul searching.',
    bpm: 210,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '1509920038',
    soundcloudUrl: 'https://soundcloud.com/trinitrocosmic/the-soul-seeker210-bpm-trinitrocosmic',
    isFeatured: false,
    tags: ['Hi-Tech', 'Remix', 'Soul', 'Consciousness'],
    playCount: 2650,
    likeCount: 198,
  },
  {
    slug: 'cosmic-thillana',
    title: 'Cosmic Thillana (Hi-Tech Special Mix)',
    artistLabel: 'Trinitrocosmic / DJ Felicitous',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.COLLABORATION,
    genreLabels: ['Hi-Tech'],
    description:
      'A hi-tech remix of classical Thillana compositions with cosmic electronic elements.',
    bpm: null,
    durationSec: null,
    releaseYear: 2023,
    soundcloudTrackId: '1419555301',
    soundcloudUrl:
      'https://soundcloud.com/trinitrocosmic/cosmic-thillana-day-to-remember-trinitrocosmicdjfelicitous',
    isFeatured: false,
    tags: ['Hi-Tech', 'Remix', 'Classical', 'Thillana'],
    playCount: 1750,
    likeCount: 134,
  },
  {
    slug: 'silence-and-solitude',
    title: 'Silence and Solitude',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.REMIX,
    genreLabels: ['Progressive Psytrance'],
    description:
      'An ambient remix exploring themes of introspection, silence and peaceful solitude.',
    bpm: null,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '1147510918',
    soundcloudUrl: 'https://soundcloud.com/trinitrocosmic/silence-and-solitude',
    isFeatured: false,
    tags: ['Ambient', 'Remix', 'Introspective'],
    playCount: 1420,
    likeCount: 98,
  },
  {
    slug: 'the-depth-of-love',
    title: 'The Depth of Love',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.REMIX,
    genreLabels: ['Hi-Tech'],
    description:
      'A deeply emotional 190 BPM remix exploring the profound depths of love and connection.',
    bpm: 190,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '1501717363',
    soundcloudUrl: 'https://soundcloud.com/djfelicitous/01-beautiful-squirting',
    isFeatured: false,
    tags: ['Emotional', 'Remix', 'Deep'],
    playCount: 2340,
    likeCount: 187,
  },
  {
    slug: 'adharam-madhuram-melodic-remix',
    title: 'Adharam Madhuram (Melodic Remix)',
    artistLabel: 'DJ Felicitous',
    personaKey: PersonaKey.FELICITOUS,
    type: TrackType.REMIX,
    genreLabels: ['Melodic Techno'],
    description:
      'A melodic remix of the devotional piece Adharam Madhuram with modern electronic elements.',
    bpm: null,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '2158575681',
    soundcloudUrl:
      'https://soundcloud.com/dj-felicitous/adharam-madhuram-melodic-remix-dj-felicitous',
    isFeatured: false,
    tags: ['Classical', 'Remix', 'Devotional', 'Melodic'],
    playCount: 1980,
    likeCount: 165,
  },
  {
    slug: 'onappattin-thalam-thullum-remix',
    title: 'Onappattin Thalam Thullum (Remix)',
    artistLabel: 'DJ Felicitous',
    personaKey: PersonaKey.FELICITOUS,
    type: TrackType.REMIX,
    genreLabels: ['South Indian Hits'],
    description:
      'A vibrant remix of the traditional Kerala festival song with modern electronic beats.',
    bpm: null,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '2165306940',
    soundcloudUrl:
      'https://soundcloud.com/dj-felicitous/onappattin-thalam-thullum-remix-dj-felicitous',
    isFeatured: false,
    tags: ['Traditional', 'Remix', 'Kerala', 'Onam'],
    playCount: 1560,
    likeCount: 112,
  },

  // --------------------------------------------------------------- live sets
  {
    slug: 'commercial-sing-along-non-stop-mix',
    title: 'Commercial Sing Along Non-Stop Mix',
    artistLabel: 'DJ Felicitous',
    personaKey: PersonaKey.FELICITOUS,
    type: TrackType.LIVE_SET,
    genreLabels: ['Commercial', 'Bollywood'],
    description:
      'A high-energy non-stop commercial sing-along mix, built for parties and celebrations.',
    bpm: null,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '2148256914',
    soundcloudUrl:
      'https://soundcloud.com/dj-felicitous/commercial-sing-along-non-stop-mix-dj-felicitous',
    isFeatured: true,
    tags: ['Commercial', 'Bollywood', 'Party', 'Non-Stop'],
    playCount: 4850,
    likeCount: 412,
  },
  {
    slug: 'melodic-afro-bolly-house-mix',
    title: 'Melodic Afro Bolly House Mix',
    artistLabel: 'DJ Felicitous',
    personaKey: PersonaKey.FELICITOUS,
    type: TrackType.LIVE_SET,
    genreLabels: ['Afro-Bolly', 'Bollywood'],
    description:
      'A fusion of Bollywood classics with deep Afro House rhythms and melodic progressions.',
    bpm: null,
    durationSec: durationToSeconds('55:23'),
    releaseYear: 2024,
    soundcloudTrackId: '2072437752',
    soundcloudUrl:
      'https://soundcloud.com/dj_felicitous/melodic-afro-bolly-house-mix-dj-felicitous',
    isFeatured: true,
    tags: ['Bollywood', 'Afro House', 'Melodic', 'Fusion'],
    playCount: 3950,
    likeCount: 325,
  },
  {
    slug: 'melodic-techno-one-hour-non-stop-mix',
    title: 'Melodic Techno — One Hour Non-Stop Mix',
    artistLabel: 'TNT',
    personaKey: PersonaKey.TNT,
    type: TrackType.LIVE_SET,
    genreLabels: ['Melodic Techno'],
    description:
      'A seamless one-hour melodic techno journey blending deep grooves and uplifting melodies.',
    bpm: null,
    durationSec: durationToSeconds('60:00'),
    releaseYear: 2024,
    soundcloudTrackId: '2149946499',
    soundcloudUrl:
      'https://soundcloud.com/dj-felicitous-211226193/melodic-techno-1-hour-non-stop-mix-dj-felicitous',
    isFeatured: false,
    tags: ['Melodic Techno', 'Non-Stop', 'Mix'],
    playCount: 2780,
    likeCount: 234,
  },
  {
    slug: 'technoverse-volume-i',
    title: 'Technoverse Volume I',
    artistLabel: 'TNT',
    personaKey: PersonaKey.TNT,
    type: TrackType.LIVE_SET,
    genreLabels: ['Melodic Techno'],
    description:
      'An immersive journey through melodic techno soundscapes with hypnotic basslines and atmospheric pads.',
    bpm: null,
    durationSec: durationToSeconds('62:45'),
    releaseYear: 2024,
    soundcloudTrackId: '1601264592',
    soundcloudUrl: 'https://soundcloud.com/dj_felicitous/technoverse-volume-i',
    isFeatured: false,
    tags: ['Melodic Techno', 'Progressive', 'Atmospheric'],
    playCount: 3120,
    likeCount: 267,
  },
  {
    slug: 'heart-beat-of-the-universe',
    title: 'Heart Beat of the Universe (Hi-Tech Mini Mix)',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.LIVE_SET,
    genreLabels: ['Hi-Tech', 'Psytrance'],
    description:
      'A high-energy 190 BPM hi-tech psytrance mini mix exploring the cosmic rhythms of the universe.',
    bpm: 190,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '1767501783',
    soundcloudUrl: 'https://soundcloud.com/trinitrocosmic/01-rec-2024-03-07',
    isFeatured: false,
    tags: ['Hi-Tech', 'Psytrance', 'Cosmic'],
    playCount: 2460,
    likeCount: 198,
  },
  {
    slug: 'ohm-hreem-namaha-live-set',
    title: 'Ohm Hreem Namaha (Live Set)',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.LIVE_SET,
    genreLabels: ['Psytrance'],
    description:
      'A spiritual electronic journey combining ancient mantras with modern electronic beats.',
    bpm: null,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '1502186674',
    soundcloudUrl:
      'https://soundcloud.com/trinitrocosmic/ohm-hreem-namaha-live-dj-set-trinitrocosmic',
    isFeatured: false,
    tags: ['Spiritual', 'Mantra', 'Live Set'],
    playCount: 1890,
    likeCount: 145,
  },
  {
    slug: 'old-is-gold',
    title: 'Old Is Gold',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.LIVE_SET,
    genreLabels: ['Psytrance'],
    description: 'A nostalgic journey through classic tracks with a modern electronic twist.',
    bpm: null,
    durationSec: null,
    releaseYear: 2024,
    soundcloudTrackId: '1399736419',
    soundcloudUrl: 'https://soundcloud.com/djfelicitous/old-is-gold-trinitrocosmic',
    isFeatured: false,
    tags: ['Classic', 'Nostalgic', 'Live Set'],
    playCount: 1650,
    likeCount: 124,
  },
  {
    slug: 'cosmic-celestial',
    title: 'Cosmic Celestial',
    artistLabel: 'Trinitrocosmic',
    personaKey: PersonaKey.TRINITROCOSMIC,
    type: TrackType.LIVE_SET,
    genreLabels: ['Psytrance'],
    description:
      'A celestial journey through cosmic soundscapes and ethereal electronic compositions.',
    bpm: null,
    durationSec: null,
    releaseYear: 2021,
    soundcloudTrackId: '1127143360',
    soundcloudUrl: 'https://soundcloud.com/trinitrocosmic/cosmic-celestial-2021',
    isFeatured: false,
    tags: ['Cosmic', 'Celestial', 'Live Set'],
    playCount: 2340,
    likeCount: 176,
  },
];

/**
 * Curated playlists over the seeded tracks — the "listen to my work" showcase
 * the legacy site had no way to express.
 */
export const seedPlaylists: {
  slug: string;
  title: string;
  description: string;
  personaKey: PersonaKey;
  isFeatured: boolean;
  trackSlugs: string[];
}[] = [
  {
    slug: 'originals-and-remixes',
    title: 'Originals & Remixes',
    description:
      'Studio work: original productions and the remixes that reshape Indian classical, devotional and film music into electronic form.',
    personaKey: PersonaKey.FELICITOUS,
    isFeatured: true,
    trackSlugs: [
      'trinetra-awakening',
      'neeye-melodic-remix',
      'adharam-madhuram-melodic-remix',
      'onappattin-thalam-thullum-remix',
      'gitanjali-book-of-poems-melodic-remix',
      'cosmic-thillana',
    ],
  },
  {
    slug: 'dancefloor-sets',
    title: 'Dancefloor Sets',
    description:
      'Full-length recorded sets: Bollywood, commercial and Afro-Bolly house, mixed live.',
    personaKey: PersonaKey.FELICITOUS,
    isFeatured: true,
    trackSlugs: ['commercial-sing-along-non-stop-mix', 'melodic-afro-bolly-house-mix'],
  },
  {
    slug: 'technoverse',
    title: 'Technoverse',
    description: 'Melodic and peak-time techno, recorded end to end.',
    personaKey: PersonaKey.TNT,
    isFeatured: true,
    trackSlugs: ['technoverse-volume-i', 'melodic-techno-one-hour-non-stop-mix'],
  },
  {
    slug: 'cosmic-journeys',
    title: 'Cosmic Journeys',
    description: 'Psytrance across the spectrum, from progressive to hi-tech and psycore.',
    personaKey: PersonaKey.TRINITROCOSMIC,
    isFeatured: true,
    trackSlugs: [
      'heart-beat-of-the-universe',
      'the-soul-seeker',
      'ohm-hreem-namaha-live-set',
      'cosmic-celestial',
      'silence-and-solitude',
      'cosmic-violin',
      'cosmic-tatvamasi',
      'the-depth-of-love',
      'old-is-gold',
    ],
  },
];
