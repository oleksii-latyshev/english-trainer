import { tv } from '@/shared/ui/tv';

export const bar = tv({
  base: 'block w-full rounded-md',
  variants: {
    tone: {
      empty: 'bg-quiet-line',
      soft: 'bg-accent/45',
      strong: 'bg-accent',
    },
  },
  defaultVariants: { tone: 'soft' },
});
