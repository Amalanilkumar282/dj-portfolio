import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { createElement } from 'react';


/**
 * The one-page EPK PDF.
 *
 * Built with `createElement` rather than JSX: `apps/api`'s `tsconfig.json`
 * has no `jsx` compiler option and only includes `.ts` files, and widening
 * that for one template is a bigger change than the template itself. If a
 * second PDF template shows up, that trade-off is worth revisiting.
 */
const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', color: '#111111' },
  heading: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#555555', marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6 },
  paragraph: { lineHeight: 1.5, marginBottom: 4 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  statBox: { width: 120 },
  statValue: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  statLabel: { fontSize: 9, color: '#666666' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 9, color: '#888888' },
});

export interface EpkPdfInput {
  stageName: string;
  subtitle: string | null;
  bioShort: string | null;
  homeCity: string | null;
  country: string | null;
  genres: string[];
  stats: { label: string; value: string; suffix: string | null }[];
  contactEmail: string;
  bookingEmail: string | null;
  siteName: string;
  websiteUrl: string;
}

export async function renderEpkPdf(input: EpkPdfInput): Promise<Buffer> {
  const doc = createElement(
    Document,
    { title: `${input.stageName} — Press Kit` },
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(Text, { style: styles.heading }, input.stageName),
      input.subtitle ? createElement(Text, { style: styles.subtitle }, input.subtitle) : null,
      createElement(
        Text,
        { style: styles.paragraph },
        [input.homeCity, input.country].filter(Boolean).join(', '),
      ),
      input.genres.length > 0
        ? createElement(Text, { style: styles.paragraph }, input.genres.join(' · '))
        : null,
      input.bioShort
        ? createElement(
            View,
            {},
            createElement(Text, { style: styles.sectionTitle }, 'Biography'),
            createElement(Text, { style: styles.paragraph }, input.bioShort),
          )
        : null,
      input.stats.length > 0
        ? createElement(
            View,
            {},
            createElement(Text, { style: styles.sectionTitle }, 'By the numbers'),
            createElement(
              View,
              { style: styles.statsRow },
              ...input.stats.map((stat) =>
                createElement(
                  View,
                  { key: stat.label, style: styles.statBox },
                  createElement(Text, { style: styles.statValue }, `${stat.value}${stat.suffix ?? ''}`),
                  createElement(Text, { style: styles.statLabel }, stat.label),
                ),
              ),
            ),
          )
        : null,
      createElement(
        View,
        {},
        createElement(Text, { style: styles.sectionTitle }, 'Contact'),
        createElement(Text, { style: styles.paragraph }, input.bookingEmail ?? input.contactEmail),
        createElement(Text, { style: styles.paragraph }, input.websiteUrl),
      ),
      createElement(Text, { style: styles.footer }, `${input.siteName} — generated ${new Date().toISOString().slice(0, 10)}`),
    ),
  );

  return renderToBuffer(doc);
}
