import { tv } from '@/shared/ui/tv';

export const phraseBar = tv({
  slots: {
    root: 'rounded-card border-line bg-surface shadow-overlay backdrop-blur-glass flex flex-wrap items-center gap-3 border px-4 py-3 backdrop-saturate-170',
    label: 'text-faint text-pip font-bold tracking-wide uppercase',
    phrase: 'text-base font-bold',
    mask: 'flex gap-1',
    bar: 'bg-surface-3 block h-3 rounded-md',
    status: 'text-caption text-muted flex items-center gap-1.5 capitalize',
    cued: 'text-caption text-warn-text ml-auto',
  },
});

export const statusDot = tv({
  base: 'block size-1.75 rounded-full',
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
