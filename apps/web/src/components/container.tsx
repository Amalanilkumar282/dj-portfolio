import { cn } from '@dj/ui/lib/cn';

export function Container({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-(--spacing-gutter)', className)} {...props}>
      {children}
    </div>
  );
}

export function Section({
  className,
  children,
  ...props
}: React.ComponentProps<'section'>): React.JSX.Element {
  return (
    <section className={cn('py-(--spacing-section)', className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  /**
   * The heading level. `h2` by default, because this component's usual job
   * is to title a section *within* a page that already has an `h1`.
   *
   * A page whose only heading is this one must pass `as="h1"`: a document
   * with no `h1` gives a screen-reader user no top-level landmark to jump
   * to, and hands a crawler no primary heading for the page — which matters
   * on a route meant to rank. The visual size is unchanged either way; this
   * changes the element, not the design.
   */
  as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  as?: 'h1' | 'h2';
}): React.JSX.Element {
  return (
    <div className="mb-10 max-w-2xl">
      {eyebrow ? (
        <p className="text-eyebrow text-accent mb-3 font-semibold tracking-(--text-eyebrow--letter-spacing) uppercase">
          {eyebrow}
        </p>
      ) : null}
      <Heading className="font-display text-h2 text-fg-strong">{title}</Heading>
      {description ? <p className="text-lead text-fg-secondary mt-4">{description}</p> : null}
    </div>
  );
}
