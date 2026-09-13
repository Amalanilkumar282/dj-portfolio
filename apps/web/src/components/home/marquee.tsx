import { cn } from '@dj/ui/lib/cn';

/**
 * A seamless scrolling band.
 *
 * Server-rendered: the animation is pure CSS on `transform`, so there is no
 * island cost and nothing to hydrate. The list is duplicated once and the
 * copy is `aria-hidden`, so the loop is seamless without a screen reader
 * hearing 22 genres twice. Under reduced motion `--duration-*` collapses and
 * the band simply sits still with its content still readable.
 */
export function Marquee({
  items,
  className,
}: {
  items: string[];
  className?: string;
}): React.JSX.Element {
  const row = (hidden: boolean): React.JSX.Element => (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8 motion-ok:animate-[marquee-x_38s_linear_infinite]"
    >
      {items.map((item) => (
        <li key={item} className="text-fg-muted font-display text-h4 whitespace-nowrap uppercase">
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        'relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]',
        className,
      )}
    >
      {row(false)}
      {row(true)}
    </div>
  );
}
