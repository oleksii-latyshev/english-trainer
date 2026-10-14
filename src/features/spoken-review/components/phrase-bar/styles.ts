import { tv } from '@/shared/ui/tv';

export const phraseBar = tv({
  slots: {
    root: 'flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-overlay backdrop-blur-glass backdrop-saturate-170',
    label: 'font-bold text-faint text-pip uppercase tracking-wide',
    phrase: 'font-bold text-base',
    mask: 'flex gap-1',
    bar: 'block h-3 rounded-md bg-surface-3',
    status: 'flex items-center gap-1.5 text-caption text-muted capitalize',
    cued: 'ml-auto text-caption text-warn-text',
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
