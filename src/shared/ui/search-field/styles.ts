import { tv } from '@/shared/ui/tv';

export const searchField = tv({
  slots: {
    root: 'flex flex-col gap-1',
    group:
      'border-control-line bg-surface-2 text-body text-foreground focus-within:ring-accent hover:not-focus-within:bg-surface-3 relative inline-flex h-9 items-center overflow-hidden rounded-full border transition duration-150 ease-in-out outline-none focus-within:ring-2 motion-reduce:transition-none',
    icon: 'text-muted pointer-events-none ms-3 me-0 size-4 shrink-0',
    input:
      'text-body placeholder:text-muted h-full flex-1 rounded-none border-0 bg-transparent py-2 ps-2 pe-2 shadow-none outline-none',
    clear:
      'bg-surface-3 text-muted hover:bg-surface-3-hover focus-visible:ring-accent me-2 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xl p-1 transition duration-100 ease-out outline-none focus-visible:ring-2 motion-reduce:transition-none',
  },
  variants: {
    empty: {
      true: { clear: 'pointer-events-none opacity-0' },
      false: {},
    },
  },
  defaultVariants: { empty: true },
});
