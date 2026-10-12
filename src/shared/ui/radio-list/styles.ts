import { tv } from '@/shared/ui/tv';

export const radioList = tv({
  slots: {
    root: 'flex flex-col gap-1 px-3 pb-3',
    row: 'flex items-center gap-2',
    radio:
      'group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left outline-none transition duration-150 ease-in-out hover:bg-quiet focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-checked:bg-accent-soft data-checked:shadow-nav-active motion-reduce:transition-none',
    dot: 'grid size-4.5 shrink-0 place-items-center rounded-full border border-control-line group-data-checked:border-accent',
    indicator: 'size-2 rounded-full bg-accent',
    copy: 'min-w-0',
    label: 'block font-semibold text-control',
    description: 'mt-0.5 block text-muted text-xs',
  },
});
