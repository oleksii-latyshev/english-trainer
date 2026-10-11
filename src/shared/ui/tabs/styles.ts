import { tv } from '@/shared/ui/tv';

export const tabs = tv({
  slots: {
    root: 'flex flex-col gap-2',
    list: 'relative isolate inline-flex w-max flex-row gap-0.5 rounded-full border border-control-line bg-surface-2 p-1',
    tab: 'relative z-1 flex h-8 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-3.5 text-center font-semibold text-control text-muted outline-none transition duration-150 ease-in-out hover:not-data-active:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-active:font-bold data-active:text-foreground motion-reduce:transition-none',
    indicator:
      'absolute top-(--active-tab-top) left-(--active-tab-left) -z-1 h-(--active-tab-height) w-(--active-tab-width) rounded-full bg-surface-3 shadow-control transition-all duration-250 ease-fluid motion-reduce:transition-none',
    panel: 'mt-4 w-full p-2 outline-none',
  },
});
