import { tv } from '@/shared/ui/tv';

export const statusDot = tv({
  base: 'inline-block size-2 flex-none rounded-full',
  variants: {
    status: {
      new: 'bg-status-new',
      learning: 'bg-accent',
      improving: 'bg-status-improving',
      stable: 'bg-ok',
      archived: 'bg-quiet-line',
    },
  },
});
