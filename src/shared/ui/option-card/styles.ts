import { tv } from '@/shared/ui/tv';

export const optionCard = tv({
  slots: {
    root: 'flex cursor-pointer flex-col gap-2.5 rounded-card border border-line bg-surface p-4.5 text-left shadow-overlay outline-none backdrop-blur-glass backdrop-saturate-170 transition duration-150 ease-in-out hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-50 aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:shadow-sky motion-reduce:transition-none',
    icon: 'flex size-9 items-center justify-center rounded-control bg-quiet text-quiet-foreground',
    title: 'font-bold text-body',
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
