import { tv } from '@/shared/ui/tv';

export const select = tv({
  slots: {
    trigger:
      'flex h-8.5 min-w-52 cursor-pointer items-center justify-between gap-3 rounded-control border border-control-line bg-surface-2 px-3 text-caption text-foreground outline-none transition duration-150 ease-in-out hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-default data-popup-open:bg-surface-3 data-disabled:opacity-50 motion-reduce:transition-none',
    value: 'truncate data-placeholder:text-faint',
    icon: 'flex-none text-muted',
    positioner: 'z-50 outline-none',
    popup:
      'min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-2xl border border-line bg-overlay p-1 text-caption shadow-overlay outline-none backdrop-blur-glass backdrop-saturate-170 transition duration-150 ease-in-out data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-100 motion-reduce:transition-none',
    list: 'max-h-(--available-height) overflow-y-auto outline-none',
    item: 'grid cursor-pointer select-none grid-cols-[1rem_1fr] items-center gap-2 rounded-xl px-2.5 py-1.5 text-foreground outline-none data-highlighted:bg-surface-3',
    indicator: 'col-start-1 text-accent',
    itemText: 'col-start-2',
  },
});
