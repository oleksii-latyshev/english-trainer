import { tv } from '@/shared/ui/tv';

export const button = tv({
  base: 'h-8.5 cursor-pointer whitespace-nowrap rounded-full border px-3.5 font-medium text-control focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50',
  variants: {
    tone: {
      neutral: 'border-line bg-surface-2 text-foreground enabled:hover:bg-surface-3',
      ghost: 'border-transparent bg-transparent text-muted enabled:hover:bg-surface-2',
    },
  },
  defaultVariants: { tone: 'neutral' },
});
