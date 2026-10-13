import { tv } from '@/shared/ui/tv';

export const heatCell = tv({
  base: 'block size-4.5 rounded-md',
  variants: {
    level: {
      0: 'bg-quiet',
      1: 'bg-accent/25',
      2: 'bg-accent/45',
      3: 'bg-accent/70',
      4: 'bg-accent shadow-glow',
    },
    today: { true: 'outline-2 outline-foreground outline-offset-1', false: '' },
    upcoming: { true: 'border border-line border-dashed bg-transparent', false: '' },
  },
  defaultVariants: { level: 0, today: false, upcoming: false },
});
