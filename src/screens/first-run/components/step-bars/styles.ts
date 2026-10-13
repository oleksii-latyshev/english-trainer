import { tv } from '@/shared/ui/tv';

export const stepBar = tv({
  base: 'block h-1 w-7 rounded-xs',
  variants: {
    status: {
      done: 'bg-accent',
      current: 'bg-foreground',
      upcoming: 'bg-surface-3',
    },
  },
});
