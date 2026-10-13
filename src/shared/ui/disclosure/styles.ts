import { tv } from '@/shared/ui/tv';

export const disclosure = tv({
  slots: {
    root: 'border-line-soft border-t px-5 py-3',
    trigger:
      'group flex cursor-pointer items-center gap-1.5 rounded-control text-caption text-muted outline-none transition duration-150 ease-in-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none',
    icon: 'size-3.5 flex-none transition duration-150 ease-in-out group-data-panel-open:rotate-90 motion-reduce:transition-none',
    panel: 'flex flex-col gap-2.5 pt-2.5 text-caption text-muted leading-copy',
  },
});
