import { tv } from '@/shared/ui/tv';

export const answerResult = tv({
  slots: {
    bubble:
      'max-w-150 self-end rounded-card rounded-br-md border border-accent-line bg-accent-soft px-4 py-3 text-body leading-normal',
    caption: 'mb-1 font-bold text-faint text-pip uppercase tracking-wide',
    mark: 'rounded-md bg-ok-soft px-1 text-ok-text',
    card: 'flex flex-col gap-2.5 rounded-card border px-4 py-3.5 backdrop-blur-glass',
    head: 'flex items-center gap-3.5',
    icon: 'flex size-8.5 flex-none items-center justify-center rounded-full',
    title: 'font-bold text-body',
    hint: 'mt-0.5 text-caption text-muted',
    model: 'rounded-control bg-quiet px-3 py-2.5 text-control leading-normal',
    modelLabel: 'mr-2 font-bold text-ok-text text-pip uppercase tracking-wide',
    actions: 'flex flex-wrap justify-end gap-2',
  },
  variants: {
    tone: {
      used: { card: 'border-ok-line bg-ok-soft', icon: 'bg-ok text-on-ok' },
      'not-yet': { card: 'border-line bg-surface', icon: 'bg-warn-soft text-warn-text' },
    },
  },
});
