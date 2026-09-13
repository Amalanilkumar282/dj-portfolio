import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getPressAssets } from '../../../server/queries/press-assets';

export const metadata: Metadata = {
  title: 'Press kit',
  description: 'Logos, hi-res photos, bio and EPK for press, promoters and venues.',
  alternates: { canonical: absoluteUrl('/press') },
};

const KIND_LABELS: Record<string, string> = {
  LOGO_PACK: 'Logo pack',
  LOGO_SVG: 'Logo (SVG)',
  HI_RES_PHOTO: 'Hi-res photo',
  TECH_RIDER: 'Technical rider',
  STAGE_PLOT: 'Stage plot',
  BIO_PDF: 'Biography',
  EPK_PDF: 'Electronic press kit',
  RIDER_HOSPITALITY: 'Hospitality rider',
};

export default async function PressPage(): Promise<React.JSX.Element> {
  const assets = await getPressAssets();

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="For promoters & press" title="Press kit" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-md border border-border bg-surface p-5">
              <p className="text-accent text-xs font-semibold uppercase">{KIND_LABELS[asset.kind] ?? asset.kind}</p>
              <p className="text-fg-strong mt-2 font-semibold">{asset.title}</p>
              {asset.description ? <p className="text-fg-muted mt-1 text-sm">{asset.description}</p> : null}
              <p className="text-fg-muted mt-3 text-xs">
                {asset.requiresEmail ? 'Email required to download' : 'Free download'}
              </p>
            </div>
          ))}
        </div>
        {assets.length === 0 ? (
          <p className="text-fg-muted">
            The press kit isn&apos;t published yet — check back soon, or reach out via{' '}
            <Link href="/contact" className="text-accent underline">
              contact
            </Link>
            .
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
