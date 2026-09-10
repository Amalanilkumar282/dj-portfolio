import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
