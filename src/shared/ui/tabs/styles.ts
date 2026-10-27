import { tv } from '@/shared/ui/tv';

export const tabs = tv({
  slots: {
    root: 'flex flex-col gap-2',
    list: 'border-control-line bg-surface-2 relative isolate inline-flex w-max flex-row gap-0.5 rounded-full border p-1',
    tab: 'text-control text-muted hover:not-data-active:text-foreground focus-visible:ring-accent focus-visible:ring-offset-background data-active:text-foreground relative z-1 flex h-8 w-full cursor-pointer items-center justify-center rounded-full px-3.5 text-center font-semibold whitespace-nowrap transition duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-active:font-bold motion-reduce:transition-none',
    indicator:
      'bg-surface-3 shadow-control ease-fluid absolute top-(--active-tab-top) left-(--active-tab-left) -z-1 h-(--active-tab-height) w-(--active-tab-width) rounded-full transition-all duration-250 motion-reduce:transition-none',
    panel: 'mt-4 w-full p-2 outline-none',
  },
});
