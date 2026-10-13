import { tv } from '@/shared/ui/tv';

export const levelMeter = tv({
  slots: {
    root: 'flex h-5 items-center gap-0.75',
    bar: 'block h-4 w-1.5 rounded-xs bg-surface-3 data-on:bg-ok',
  },
});
