import { tv } from '@/shared/ui/tv';

export const searchField = tv({
  slots: {
    root: 'flex flex-col gap-1',
    group:
      'relative inline-flex h-9 items-center overflow-hidden rounded-full border border-control-line bg-surface-2 text-body text-foreground outline-none transition duration-150 ease-in-out focus-within:ring-2 focus-within:ring-accent hover:not-focus-within:bg-surface-3 motion-reduce:transition-none',
    icon: 'pointer-events-none ms-3 me-0 size-4 shrink-0 text-muted',
    input:
      'h-full flex-1 rounded-none border-0 bg-transparent py-2 ps-2 pe-2 text-body shadow-none outline-none placeholder:text-muted',
    clear:
      'me-2 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-surface-3 p-1 text-muted outline-none transition duration-100 ease-out hover:bg-surface-3-hover focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none',
  },
  variants: {
    empty: {
      true: { clear: 'pointer-events-none opacity-0' },
      false: {},
    },
  },
  defaultVariants: { empty: true },
});
