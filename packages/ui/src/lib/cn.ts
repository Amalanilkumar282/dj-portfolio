import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The project's custom font-size scale.
 *
 * tailwind-merge ships a list of the *stock* Tailwind class names and infers
 * the rest. Our `@theme` block in theme.css adds `--text-display`,
 * `--text-lead` and friends, which tailwind-merge has no way to know about —
 * so it classified `text-lead` as a text **colour** and treated it as
 * conflicting with `text-on-accent`. The later class won and the earlier one
 * was silently dropped.
 *
 * That was not theoretical: the solid Button emitted
 * `bg-accent … text-on-accent … text-lead`, tailwind-merge removed
 * `text-on-accent`, and every primary CTA on the site rendered body-coloured
 * text on an accent fill. Chips lost `text-eyebrow` the same way.
 *
 * Keep this list in sync with the `--text-*` tokens in
 * packages/ui/src/styles/theme.css. Adding a token without adding it here
 * reintroduces the bug for that one size, silently.
 */
const FONT_SIZES = ['body', 'display', 'eyebrow', 'h1', 'h2', 'h3', 'h4', 'lead'] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZES] }],
    },
  },
});

/**
 * Merges class names, resolving Tailwind conflicts so a caller-supplied
 * `className` reliably wins over a component default.
 *
 * Without twMerge, `cn('px-5', 'px-8')` emits both and the outcome depends on
 * CSS source order rather than on the call site — which makes overriding a
 * variant unpredictable.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
