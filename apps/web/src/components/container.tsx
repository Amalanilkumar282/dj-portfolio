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
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
}): React.JSX.Element {
  return (
    <div className="mb-10 max-w-2xl">
      {eyebrow ? (
        <p className="text-eyebrow text-accent mb-3 font-semibold tracking-(--text-eyebrow--letter-spacing) uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-h2 text-fg-strong">{title}</h2>
      {description ? <p className="text-lead text-fg-secondary mt-4">{description}</p> : null}
    </div>
  );
}
