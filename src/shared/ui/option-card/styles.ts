import { tv } from '@/shared/ui/tv';

export const optionCard = tv({
  slots: {
    root: 'rounded-card border-line bg-surface shadow-overlay backdrop-blur-glass hover:bg-surface-2 focus-visible:ring-accent focus-visible:ring-offset-background aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:shadow-sky flex cursor-pointer flex-col gap-2.5 border p-4.5 text-left backdrop-saturate-170 transition duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none',
    icon: 'rounded-control bg-quiet text-quiet-foreground flex size-9 items-center justify-center',
    title: 'text-body font-bold',
    description: 'text-control text-muted leading-snug',
  },
  variants: {
    selected: {
      true: { icon: 'bg-accent text-on-accent', description: 'text-quiet-foreground' },
      false: {},
    },
  },
  defaultVariants: { selected: false },
});
