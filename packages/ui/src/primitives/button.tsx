import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

/**
 * The canonical button, per docs/03-design-system/components.md.
 *
 * Five things this encodes deliberately:
 * - semantic colour names only, never a source ramp or a hex, so every
 *   variant re-themes itself across all four personas for free
 * - `hover-hover:` rather than `hover:` — on touch a plain hover state
 *   sticks after a tap and looks broken
 * - `motion-ok:` on the press scale, so it simply does not exist under
 *   reduced motion
 * - the transition property is **enumerated**, never `transition-all`, which
 *   animates layout properties by accident
 * - `size-11` is 44px, the primary touch-target minimum (WCAG 2.5.8)
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-[transform,background-color,box-shadow,border-color,color] duration-(--duration-fast) ease-(--ease-out-quart) focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none motion-ok:active:scale-[0.98]',
  {
    variants: {
      variant: {
        solid: 'bg-accent text-on-accent hover-hover:hover:bg-accent-strong hover-hover:hover:shadow-glow',
        outline:
          'border border-border text-fg hover-hover:hover:border-accent hover-hover:hover:text-accent',
        ghost: 'text-fg-muted hover-hover:hover:text-fg hover-hover:hover:bg-surface-raised',
        neon: 'bg-transparent text-accent border border-accent shadow-glow hover-hover:hover:bg-accent-soft',
        link: 'text-accent underline underline-offset-4 hover-hover:hover:text-accent-strong',
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md',
        md: 'h-11 px-5 text-body rounded-lg',
        lg: 'h-14 px-8 text-lead rounded-lg',
        icon: 'size-11 rounded-lg',
      },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof button>;

export function buttonClass({ variant, size, className }: ButtonVariants & { className?: string | undefined }): string {
  return cn(button({ variant, size }), className);
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<'button'> & ButtonVariants): React.JSX.Element {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}
