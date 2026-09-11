import { notFound } from 'next/navigation';

import { personaThemeName } from '../../../lib/site';
import { getPersona } from '../../../server/queries/personas';

/**
 * Sets `data-theme` on a wrapper so every page under `/[persona]` (including
 * `/[persona]/music`) inherits the persona's accent colours from
 * `theme.css` — see docs/03-design-system/persona-theming.md. The CMS's own
 * `accentColor`/`accentColorSecondary` become inline custom properties too,
 * so the artist can retune a persona without a deploy.
 */
export default async function PersonaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ persona: string }>;
}): Promise<React.JSX.Element> {
  const { persona: slug } = await params;
  const persona = await getPersona(slug);
  if (!persona) notFound();

  return (
    <div
      data-theme={personaThemeName(persona.key)}
      style={
        {
          '--color-accent': persona.accentColor,
          ...(persona.accentColorSecondary ? { '--color-accent-strong': persona.accentColorSecondary } : {}),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
