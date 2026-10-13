import { tv } from '@/shared/ui/tv';

export const statusSegment = tv({
  base: 'flex-1 basis-0',
  variants: {
    status: {
      new: 'bg-status-new',
      learning: 'bg-accent',
      improving: 'bg-status-improving',
      stable: 'bg-ok',
    },
  },
});
