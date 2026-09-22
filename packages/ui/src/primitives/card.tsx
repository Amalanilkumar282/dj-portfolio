import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

/**
 * The bordered surface every list of things on this site sits on.
 *
 * It existed already — as a hand-copied
 * `rounded-md border border-border hover:border-accent transition-…` string
 * repeated across the residency cards, the service cards, the gallery cards,
 * the venue cards and the testimonial quotes. Each copy had drifted slightly
 * (different radius, different transition property, some missing the
 * `hover-hover:` guard that stops a touch device latching the hover state),
 * which is exactly how a design system stops being one.
 *
 * `hover-hover:` is not optional. Without it, a tap on a touch screen leaves
 * the accent border stuck on until something else is tapped, because there is
 * no pointer-leave event coming.
 */
const card = cva('rounded-md border', {
  variants: {
    tone: {
      /** The default: a hairline that recedes until you reach for it. */
      outline: 'border-border bg-transparent',
      /** For cards over a busy backdrop — poster art, a shader, a photo. */
      raised: 'border-border bg-surface/60 backdrop-blur-sm',
    },
    interactive: {
      true: 'hover-hover:hover:border-accent transition-[border-color,transform] duration-(--duration-fast) ease-(--ease-out-quart) motion-ok:hover-hover:hover:-translate-y-0.5',
      false: '',
    },
  },
  defaultVariants: { tone: 'outline', interactive: false },
});

export type CardVariants = VariantProps<typeof card>;

export function cardClass({
  tone,
  interactive,
  className,
}: CardVariants & { className?: string | undefined }): string {
  return cn(card({ tone, interactive }), className);
}

export function Card({
  tone,
  interactive,
  className,
  ...props
}: React.ComponentProps<'div'> & CardVariants): React.JSX.Element {
  return <div className={cardClass({ tone, interactive, className })} {...props} />;
}
