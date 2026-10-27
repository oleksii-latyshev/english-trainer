import { tv } from '@/shared/ui/tv';

export const input = tv({
  base: 'text-control text-foreground focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
  variants: {
    appearance: {
      boxed:
        'rounded-control border-line bg-background max-narrow:w-50 h-8.5 w-65 border px-3 font-mono',
      plain: 'rounded-control text-muted min-w-0 flex-1 border-0 bg-transparent text-right',
    },
  },
  defaultVariants: { appearance: 'boxed' },
});
