# Brand and content rules

## The hard rule: never invent content

> **No fabricated testimonials. No venues he has not played. No invented gig
> dates. No made-up press quotes. No guessed prices. No placeholder social
> proof that reads as real.**

This is not a stylistic preference. The legacy site attributed invented
testimonials to **Boom Festival, Ozora, Rainbow Serpent, Berghain, Fabric and
Tresor** — none of which the artist has played.

Three reasons that matters:

1. **It is a false claim to paying clients.** A promoter who knows the Berghain
   booking process would recognise it instantly, and the credibility loss is
   total.
2. **Fabricated `Review` or `AggregateRating` markup is an explicit Google
   structured-data violation**, risking a manual action against the whole
   domain.
3. **It is the artist's reputation, not ours.**

### How this is enforced

- All eight harvested testimonials are seeded `isVerified: false`. `Review` and
  `AggregateRating` JSON-LD are emitted **only** for verified ones.
- An integration test asserts no testimonial mentions those six venues, and
  that no testimonial is seeded verified.
- **No `Event` rows are seeded from legacy data**, because the legacy gig list
  had no dates. Demo events are prefixed `[DEMO]`.
- Service prices are seeded `null`, so `formatPriceRange` renders "On request".
- An integration test asserts no service has a price.

### If you need placeholder content while building

Use `seed:demo`, which prefixes everything `[DEMO]` and never runs outside
development. Never put plausible-looking fake content into `seed:content` or
into a component's default props — it will eventually reach production, because
that is what plausible-looking placeholder content does.

---

## Voice

**Confident, specific, unpretentious.**

The audience is split between people booking a wedding — who need reassurance
and clarity — and promoters, who need credibility and specifics. The voice has
to serve both, which means concrete facts rather than adjectives.

| Do                                                                                    | Do not                                         |
| ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| "Bollywood, South Indian and commercial. Weddings, corporate and clubs across India." | "The ultimate world-class party experience!!!" |
| "140 BPM average. CDJ-3000 and DJM-A9."                                               | "Insane vibes and next-level energy"           |
| "Replies within 24 hours."                                                            | "Contact us today!"                            |
| "From ₹X" or "On request"                                                             | "Affordable rates"                             |
| "Played Big Pitcher, Pebbles, XU at The Leela Palace"                                 | "Played the biggest venues in India"           |

Specifics are more persuasive than superlatives, and they are also true.

### Per-persona register

| Persona                      | Register                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **DJ Felicitous**            | Warm, celebratory, family-friendly. The wedding audience.                            |
| **DJ Felicitous & DJ Geetz** | Personal, story-led. The duo is the hook.                                            |
| **Trinitrocosmic**           | Immersive, mystical, technical. Sub-genres by name — the psytrance audience notices. |
| **TNT**                      | Terse, industrial, precise. Mono type. Fewest words of the four.                     |

The four personas share a design system but not a tone. TNT should not sound
like a wedding page.

---

## Palette

Full token detail in
[`../03-design-system/tokens.md`](../03-design-system/tokens.md).

|                          | Accent           | Direction                               |
| ------------------------ | ---------------- | --------------------------------------- |
| DJ Felicitous            | rose → flame     | Warm, celebratory                       |
| DJ Felicitous & DJ Geetz | rose → violet    | Dual identity                           |
| Trinitrocosmic           | violet → magenta | Psychedelic, conic gradient             |
| TNT                      | cyan             | Industrial, sharp corners, mono display |

Ground is a blue-cooled near-black (`ink-950`), never pure black and never pure
grey — pure grey reads cheap next to saturated accents.

**Accents are CMS-editable** (`Persona.accentColor`), so the artist can retune
a persona without a deploy. `theme.css` holds the designed defaults as the
fallback.

## Type

Display **Anybody** (wide, brutalist), body **Satoshi** (neutral, professional),
mono **JetBrains Mono** (BPM, keys, timecodes, rider — and TNT's display face).
See [`../03-design-system/typography.md`](../03-design-system/typography.md).

## Naming and spelling

| Use                                 | Not                                   |
| ----------------------------------- | ------------------------------------- |
| **Bengaluru**                       | Banglore, Banglore                    |
| DJ Felicitous                       | dj felicitous, DJ FELICITOUS in prose |
| Trinitrocosmic                      | Tinitro Cosmic, TrinitroCosmic        |
| TNT                                 | T.N.T.                                |
| DJ Felicitous & DJ Geetz            | DJ Felicitous and DJ Geetz in a title |
| psytrance                           | psy-trance, Psy Trance                |
| Bolly-Tech                          | Bollytech, Bolly Tech                 |
| sangeet                             | Sangeet mid-sentence                  |
| ₹ with `en-IN` grouping (₹2,50,000) | ₹250,000                              |

"Bengaluru" is the current official name and the one used in search; the legacy
site had it misspelled as "Banglore".

## Photography and video

- **Every image needs alt text.** Required by contract, admin gate and a
  database CHECK constraint.
- Set the focal point on any cropped portrait, or hero crops will decapitate
  the subject.
- Credit the photographer in `MediaAsset.credit` where known.
- Hero video: 8–10 seconds, ≤2.5MB, silent, and **decorative** — the poster is
  the LCP element.
- Prefer crowd-facing shots over booth close-ups for the wedding and corporate
  pages: a planner is buying an atmosphere, not equipment.

## Legal and factual care

- Stats (`500+ events`, `10+ years`) are `Stat` rows the artist controls. They
  must be **his** numbers, not aspirational ones.
- Venue names must be spelled as the venue spells them.
- Do not claim festival appearances without a date and a source.
- Remixes are of tracks the artist does not own. Do not offer downloads, and do
  not imply distribution rights.
- Press-kit photos need photographer permission for third-party use.
