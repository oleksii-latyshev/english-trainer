import { tv } from '@/shared/ui/tv';

export const radioList = tv({
  slots: {
    root: 'flex flex-col gap-1 px-3 pb-3',
    row: 'flex items-center gap-2',
    radio:
      'group hover:bg-quiet focus-visible:ring-accent focus-visible:ring-offset-background data-checked:bg-accent-soft data-checked:shadow-nav-active flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left transition duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none',
    dot: 'border-control-line group-data-checked:border-accent grid size-4.5 shrink-0 place-items-center rounded-full border',
    indicator: 'bg-accent size-2 rounded-full',
    copy: 'min-w-0',
    label: 'text-control block font-semibold',
    description: 'text-muted mt-0.5 block text-xs',
  },
});
