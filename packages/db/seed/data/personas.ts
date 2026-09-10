import { PersonaKey } from '@prisma/client';

/**
 * Persona content harvested from the legacy static site
 * (djfelicitous/src/data/djProfiles.ts) before that directory was deleted.
 *
 * Faithful to the original copy, with these deliberate changes:
 *  - `route` becomes `slug`, renamed for SEO clarity: the old `/bollywood`,
 *    `/psytrance`, `/techno`, `/couple-duo` are preserved as 301 redirects
 *    (see redirects.ts) so no inbound link breaks.
 *  - `color` was a dead Tailwind token name (`neon-pink`) that resolved to
 *    nothing. Replaced with real hex accents.
 *  - `playlists` were fabricated placeholder URLs
 *    (spotify.com/playlist/bollywood-bangers) rendered nowhere. Dropped.
 *  - Typos fixed: "Banglore" -> "Bengaluru".
 *
 * See docs/07-content/legacy-audit.md
 */
export interface SeedPersona {
  key: PersonaKey;
  slug: string;
  stageName: string;
  subtitle: string;
  shortDescription: string;
  primaryGenreLabel: string;
  accentColor: string;
  accentColorSecondary: string;
  gradientCss: string;
  isFeatured: boolean;
  isDuo: boolean;
  memberNames: string[];
  bpmRangeLow: number | null;
  bpmRangeHigh: number | null;
  yearsActiveFrom: number | null;
  bio: string;
  genres: string[];
  /** Legacy image basenames, resolved to Cloudinary publicIds on upload. */
  legacyHeroImage: string;
  legacyGallery: string[];
  socials: { platform: string; url: string; handle?: string }[];
  seo: { title: string; description: string };
}

const SOUNDCLOUD = 'https://on.soundcloud.com/QRZFMrkVEkwIJtFKGt';
const YOUTUBE = 'https://youtube.com/@djfelicitous';
const INSTAGRAM = 'https://www.instagram.com/djfelicitous';

export const seedPersonas: SeedPersona[] = [
  {
    key: PersonaKey.COUPLE_DUO,
    slug: 'felicitous-x-geetz',
    stageName: 'DJ Felicitous & DJ Geetz',
    subtitle: 'The Dynamic Duo',
    shortDescription:
      'Two hearts, one beat. The perfect harmony of love and music, from Bollywood bangers to late-night techno.',
    primaryGenreLabel: 'Multi-Genre Duo',
    accentColor: '#F472B6',
    accentColorSecondary: '#A78BFA',
    gradientCss: 'linear-gradient(100deg, #F472B6 0%, #A78BFA 100%)',
    isFeatured: true,
    isDuo: true,
    memberNames: ['DJ Felicitous', 'DJ Geetz'],
    bpmRangeLow: 100,
    bpmRangeHigh: 140,
    yearsActiveFrom: 2019,
    bio: [
      'United by rhythm and passion, DJ Felicitous and DJ Geetz form a powerful couple duo that blends love and music into one unforgettable experience.',
      'From high-energy Bollywood bangers to South Indian chart-toppers, and late-night journeys into underground techno, this pair brings versatility, chemistry and crowd-moving magic to every set.',
      'With years of individual experience and a shared musical vision, their performances are more than DJ sets — they are a celebration of connection, culture and groove. Whether it is a big fat Indian wedding, a club night or a private party, DJ Felicitous & DJ Geetz read the crowd and deliver music that moves hearts and feet alike.',
    ].join('\n\n'),
    genres: ['Bollywood', 'South Indian Hits', 'Commercial', 'Techno', 'Deep House'],
    legacyHeroImage: 'couple-duo-hero.jpg',
    legacyGallery: [
      'couple-1.jpg',
      'couple-2.jpg',
      'couple-3.jpg',
      'couple-4.jpg',
      'couple-duo.jpg',
      'couple-duo-hero.jpg',
    ],
    socials: [
      { platform: 'instagram', url: INSTAGRAM, handle: 'djfelicitous' },
      { platform: 'soundcloud', url: SOUNDCLOUD },
      { platform: 'youtube', url: YOUTUBE },
    ],
    seo: {
      title: 'DJ Felicitous & DJ Geetz — Couple DJ Duo in Bengaluru',
      description:
        'Book DJ Felicitous & DJ Geetz, a couple DJ duo based in Bengaluru playing Bollywood, South Indian, commercial and techno for weddings, clubs and private parties.',
    },
  },
  {
    key: PersonaKey.FELICITOUS,
    slug: 'felicitous',
    stageName: 'DJ Felicitous',
    subtitle: 'Bollywood & Commercial Specialist',
    shortDescription:
      'A genre-fluid powerhouse blending Bollywood, South Indian hits, techno and house into one high-energy journey.',
    primaryGenreLabel: 'Bollywood / Commercial',
    accentColor: '#FB7185',
    accentColorSecondary: '#FB923C',
    gradientCss: 'linear-gradient(120deg, #FB7185 0%, #FB923C 100%)',
    isFeatured: false,
    isDuo: false,
    memberNames: [],
    bpmRangeLow: 95,
    bpmRangeHigh: 132,
    yearsActiveFrom: 2015,
    bio: [
      'DJ Felicitous is a genre-fluid powerhouse who refuses to be boxed in. With an ear for global rhythms and a heart rooted in desi beats, Felicitous seamlessly blends Bollywood, South Indian hits, techno, commercial and house into a high-energy sonic journey that keeps dancefloors buzzing.',
      'Whether it is a packed club, a destination wedding or a private celebration, DJ Felicitous brings unmatched versatility, crowd-reading skill and a deep connection to the vibe of every event. Each set is a dynamic story, crafted live, beat by beat, across genres and cultures.',
    ].join('\n\n'),
    genres: [
      'Bollywood',
      'South Indian Hits',
      'Bolly-Tech',
      'Afro-Bolly',
      'Commercial',
      'Tech House',
      'Progressive House',
    ],
    legacyHeroImage: 'felicitous.jpg',
    legacyGallery: [
      'bollywood1.jpg',
      'bollywood2.jpg',
      'bollywood3.jpg',
      'bollywood4.jpg',
      'bollywood5.jpg',
      'bollywood6.jpg',
    ],
    socials: [
      { platform: 'instagram', url: INSTAGRAM, handle: 'djfelicitous' },
      { platform: 'soundcloud', url: SOUNDCLOUD },
      { platform: 'youtube', url: YOUTUBE },
    ],
    seo: {
      title: 'DJ Felicitous — Bollywood & Commercial DJ in Bengaluru',
      description:
        'Bollywood, South Indian and commercial DJ based in Bengaluru. Weddings, sangeet, corporate events and club nights across India. Check availability.',
    },
  },
  {
    key: PersonaKey.TRINITROCOSMIC,
    slug: 'trinitrocosmic',
    stageName: 'Trinitrocosmic',
    subtitle: 'Psychedelic Journey Guide',
    shortDescription:
      'An immersive psytrance project born from chaos and crafted for consciousness expansion.',
    primaryGenreLabel: 'Psytrance',
    accentColor: '#A78BFA',
    accentColorSecondary: '#E879F9',
    gradientCss: 'conic-gradient(from 210deg, #7C3AED, #E879F9, #A78BFA)',
    isFeatured: false,
    isDuo: false,
    memberNames: [],
    bpmRangeLow: 138,
    bpmRangeHigh: 210,
    yearsActiveFrom: 2018,
    bio: [
      'Trinitrocosmic is an immersive psytrance experience — born from chaos, crafted for consciousness expansion. Rooted in deep frequencies and mind-bending textures, this project takes listeners through the full spectrum of psytrance sub-genres, from hypnotic progressive to the shadowy realms of dark psy, forest, frenetic hi-tech and the raw power of psycore.',
      'Each set is a ritual, designed to break boundaries, bend time and ignite primal energy on the dancefloor. Whether under the stars or deep in a soundproof bunker, Trinitrocosmic delivers a psychedelic odyssey that fuses ancient mysticism with futuristic sound design.',
    ].join('\n\n'),
    genres: ['Psytrance', 'Progressive Psytrance', 'Dark Psy', 'Forest', 'Hi-Tech', 'Psycore'],
    legacyHeroImage: 'psytrance.jpg',
    legacyGallery: ['psy1.jpg', 'psy2.jpg', 'psy3.jpg', 'psy4.jpg', 'psy5.jpg', 'psy6.jpg'],
    socials: [
      { platform: 'instagram', url: INSTAGRAM, handle: 'djfelicitous' },
      { platform: 'soundcloud', url: 'https://soundcloud.com/trinitrocosmic' },
      { platform: 'youtube', url: YOUTUBE },
    ],
    seo: {
      title: 'Trinitrocosmic — Psytrance DJ & Producer, India',
      description:
        'Psytrance project spanning progressive, dark psy, forest, hi-tech and psycore. Original productions and live sets from Bengaluru, India.',
    },
  },
  {
    key: PersonaKey.TNT,
    slug: 'tnt',
    stageName: 'TNT',
    subtitle: 'Underground Techno Architect',
    shortDescription:
      'Melodic and industrial techno built from pulsating basslines and evolving soundscapes.',
    primaryGenreLabel: 'Techno / Industrial',
    accentColor: '#22D3EE',
    accentColorSecondary: '#67E8F9',
    gradientCss: 'linear-gradient(180deg, #22D3EE 0%, #0E7490 100%)',
    isFeatured: false,
    isDuo: false,
    memberNames: [],
    bpmRangeLow: 124,
    bpmRangeHigh: 145,
    yearsActiveFrom: 2020,
    bio: [
      'TNT is a cutting-edge techno project ignited by emotion and precision. With a core focus on melodic techno, TNT crafts immersive journeys through pulsating basslines, hypnotic melodies and evolving soundscapes that resonate deep within.',
      'Exploring the full spectrum of techno sub-genres — from peak-time energy to deep, minimal and industrial textures — TNT sets are designed to elevate dancefloors and captivate minds. It is not just music; it is a sonic narrative that connects body, soul and space.',
    ].join('\n\n'),
    genres: ['Melodic Techno', 'Peak Time Techno', 'Minimal', 'Industrial Techno', 'Deep Techno'],
    legacyHeroImage: 'techno.jpg',
    legacyGallery: [
      'techno1.jpg',
      'techno2.jpg',
      'techno3.jpg',
      'techno4.jpg',
      'techno5.jpg',
      'techno6.jpg',
    ],
    socials: [
      { platform: 'instagram', url: INSTAGRAM, handle: 'djfelicitous' },
      { platform: 'soundcloud', url: SOUNDCLOUD },
      { platform: 'youtube', url: YOUTUBE },
    ],
    seo: {
      title: 'TNT — Melodic & Industrial Techno DJ in Bengaluru',
      description:
        'Melodic and industrial techno sets from Bengaluru. Peak-time, deep and minimal techno for clubs, festivals and late-night events.',
    },
  },
];
