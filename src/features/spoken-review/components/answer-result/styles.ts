import { tv } from '@/shared/ui/tv';

export const answerResult = tv({
  slots: {
    bubble:
      'rounded-card border-accent-line bg-accent-soft text-body max-w-150 self-end rounded-br-md border px-4 py-3 leading-normal',
    caption: 'text-faint text-pip mb-1 font-bold tracking-wide uppercase',
    mark: 'bg-ok-soft text-ok-text rounded-md px-1',
    card: 'rounded-card backdrop-blur-glass flex flex-col gap-2.5 border px-4 py-3.5',
    head: 'flex items-center gap-3.5',
    icon: 'flex size-8.5 flex-none items-center justify-center rounded-full',
    title: 'text-body font-bold',
    hint: 'text-caption text-muted mt-0.5',
    model: 'rounded-control bg-quiet text-control px-3 py-2.5 leading-normal',
    modelLabel: 'text-ok-text text-pip mr-2 font-bold tracking-wide uppercase',
    actions: 'flex flex-wrap justify-end gap-2',
  },
  variants: {
    tone: {
      used: { card: 'border-ok-line bg-ok-soft', icon: 'bg-ok text-on-ok' },
      'not-yet': { card: 'border-line bg-surface', icon: 'bg-warn-soft text-warn-text' },
    },
  },
});
