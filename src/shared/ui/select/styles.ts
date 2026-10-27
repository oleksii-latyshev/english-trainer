import { tv } from '@/shared/ui/tv';

export const select = tv({
  slots: {
    trigger:
      'rounded-control border-control-line bg-surface-2 text-caption text-foreground hover:bg-surface-3 focus-visible:ring-accent focus-visible:ring-offset-background data-popup-open:bg-surface-3 flex h-8.5 min-w-52 cursor-pointer items-center justify-between gap-3 border px-3 transition duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-50 motion-reduce:transition-none',
    value: 'data-placeholder:text-faint truncate',
    icon: 'text-muted flex-none',
    positioner: 'z-50 outline-none',
    popup:
      'border-line bg-overlay text-caption shadow-overlay backdrop-blur-glass min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-2xl border p-1 backdrop-saturate-170 transition duration-150 ease-in-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none',
    list: 'max-h-(--available-height) overflow-y-auto outline-none',
    item: 'text-foreground data-highlighted:bg-surface-3 grid cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 rounded-xl px-2.5 py-1.5 outline-none select-none',
    indicator: 'text-accent col-start-1',
    itemText: 'col-start-2',
  },
});
