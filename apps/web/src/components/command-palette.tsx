'use client';

import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface PersonaLink {
  slug: string;
  stageName: string;
}

const STATIC_ROUTES = [
  { label: 'Home', href: '/' },
  { label: 'Music', href: '/music' },
  { label: 'Events', href: '/events' },
  { label: 'Programs', href: '/programs' },
  { label: 'Venues', href: '/venues' },
  { label: 'About', href: '/about' },
  { label: 'Setup / gear', href: '/setup' },
  { label: 'Services', href: '/services' },
  { label: 'Press kit', href: '/press' },
  { label: 'Tech rider', href: '/rider' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Blog', href: '/blog' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
  { label: 'Book an event', href: '/book' },
];

/**
 * ⌘K / Ctrl+K jump navigation (masterplan §5.6 item 18) — scoped to static
 * routes plus personas, not a full content search index. `/api/search-
 * index` (fuzzy search across tracks/events/posts) is explicitly deferred:
 * it needs its own endpoint and a real query strategy, which is a bigger
 * piece than "wire up cmdk". This is keyboard-native by design; a
 * non-JS/no-shortcut visitor uses the same nav links every other page has.
 */
export function CommandPalette({ personas }: { personas: PersonaLink[] }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function go(href: string): void {
    setOpen(false);
    router.push(href);
  }

  if (!open) return <></>;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          setOpen(false);
        }}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        className="border-border bg-surface relative w-full max-w-md overflow-hidden rounded-lg border shadow-lg"
      >
        <Command label="Jump to">
          <Command.Input
            ref={inputRef}
            placeholder="Jump to…"
            className="text-fg-strong w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-fg-muted"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="text-fg-muted px-3 py-2 text-sm">No results.</Command.Empty>
            <Command.Group heading="Pages" className="text-fg-muted px-2 py-1 text-xs font-semibold uppercase">
              {STATIC_ROUTES.map((route) => (
                <Command.Item
                  key={route.href}
                  value={route.label}
                  onSelect={() => {
                    go(route.href);
                  }}
                  className="text-fg-strong cursor-pointer rounded-md px-3 py-2 text-sm data-[selected=true]:bg-bg"
                >
                  {route.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Personas" className="text-fg-muted px-2 py-1 text-xs font-semibold uppercase">
              {personas.map((persona) => (
                <Command.Item
                  key={persona.slug}
                  value={persona.stageName}
                  onSelect={() => {
                    go(`/${persona.slug}`);
                  }}
                  className="text-fg-strong cursor-pointer rounded-md px-3 py-2 text-sm data-[selected=true]:bg-bg"
                >
                  {persona.stageName}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
