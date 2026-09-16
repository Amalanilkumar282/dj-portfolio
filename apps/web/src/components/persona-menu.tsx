'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { useCloseOnOutsideInteraction } from './use-close-on-outside-interaction';

/**
 * The desktop header's "Personas" dropdown. Still a native
 * `<details>`/`<summary>` disclosure — click, tap and keyboard activation
 * all come for free — but as a small client island now so it can close
 * itself on an outside click/tap or Escape, which `<details>` doesn't do
 * on its own.
 */
export function PersonaMenu({
  personas,
}: {
  personas: { id: string; slug: string; stageName: string }[];
}): React.JSX.Element {
  const ref = useRef<HTMLDetailsElement>(null);
  useCloseOnOutsideInteraction(ref);

  return (
    <details ref={ref} className="group relative">
      <summary className="text-fg-secondary hover-hover:hover:text-fg-strong list-none text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden cursor-pointer">
        Personas
      </summary>
      <div className="absolute left-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-(--radius-md) border border-border bg-surface p-2 shadow-lg">
        {personas.map((persona) => (
          <Link
            key={persona.id}
            href={`/${persona.slug}`}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
            className="text-fg-secondary hover-hover:hover:text-fg-strong hover-hover:hover:bg-surface-raised whitespace-nowrap rounded-(--radius-sm) px-3 py-1.5 text-sm"
          >
            {persona.stageName}
          </Link>
        ))}
      </div>
    </details>
  );
}
