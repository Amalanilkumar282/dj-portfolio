import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

/**
 * A small label: a genre, a BPM range, a service add-on.
 *
 * `static` is the common case (a genre name is not interactive). `link` is
 * for when the chip really does navigate, and carries its own hover and
 * focus affordances.
 */
const chip = cva(
  'inline-flex items-center gap-1.5 rounded-full border text-eyebrow tracking-(--text-eyebrow--letter-spacing) uppercase transition-[color,border-color,background-color] duration-(--duration-fast) ease-(--ease-out-quart)',
  {
    variants: {
      tone: {
        muted: 'border-border text-fg-muted',
        accent: 'border-accent/40 text-accent bg-accent-soft',
        solid: 'border-transparent bg-accent text-on-accent',
      },
      size: {
        sm: 'px-2.5 py-1',
        md: 'px-3 py-1.5',
      },
      interactive: {
        true: 'hover-hover:hover:border-accent hover-hover:hover:text-accent',
        false: '',
      },
    },
    defaultVariants: { tone: 'muted', size: 'sm', interactive: false },
  },
);

export type ChipVariants = VariantProps<typeof chip>;

export function chipClass({
  tone,
  size,
  interactive,
  className,
}: ChipVariants & { className?: string | undefined }): string {
  return cn(chip({ tone, size, interactive }), className);
}

export function Chip({
  tone,
  size,
  interactive,
  className,
  ...props
}: React.ComponentProps<'span'> & ChipVariants): React.JSX.Element {
  return <span className={chipClass({ tone, size, interactive, className })} {...props} />;
}
