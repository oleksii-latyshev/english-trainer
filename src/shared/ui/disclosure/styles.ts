import { tv } from '@/shared/ui/tv';

export const disclosure = tv({
  slots: {
    root: 'border-line-soft border-t px-5 py-3',
    trigger:
      'group rounded-control text-caption text-muted hover:text-foreground focus-visible:ring-accent flex cursor-pointer items-center gap-1.5 transition duration-150 ease-in-out outline-none focus-visible:ring-2 motion-reduce:transition-none',
    icon: 'size-3.5 flex-none transition duration-150 ease-in-out group-data-panel-open:rotate-90 motion-reduce:transition-none',
    panel: 'text-caption text-muted leading-copy flex flex-col gap-2.5 pt-2.5',
  },
});
