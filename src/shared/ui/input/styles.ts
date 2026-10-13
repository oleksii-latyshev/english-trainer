import { tv } from '@/shared/ui/tv';

export const input = tv({
  base: 'text-control text-foreground focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50',
  variants: {
    appearance: {
      boxed:
        'h-8.5 w-65 rounded-control border border-line bg-background px-3 font-mono max-narrow:w-50',
      plain: 'min-w-0 flex-1 rounded-control border-0 bg-transparent text-right text-muted',
    },
  },
  defaultVariants: { appearance: 'boxed' },
});
