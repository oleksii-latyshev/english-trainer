import { tv } from '@/shared/ui/tv';

export const pip = tv({
  base: 'block h-1.5 w-5.5 rounded-xs',
  variants: {
    state: {
      done: 'bg-accent',
      current: 'bg-foreground shadow-glow',
      ahead: 'bg-surface-3',
    },
  },
});

export const pill =
  'flex h-9.5 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 shadow-control backdrop-blur-glass';
