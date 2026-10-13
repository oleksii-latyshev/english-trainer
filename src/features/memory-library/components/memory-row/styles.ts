import { tv } from '@/shared/ui/tv';

export const memoryRow = tv({
  slots: {
    item: 'border-line-soft border-b last:border-b-0',
    toggle:
      'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_8rem_7.5rem_7.5rem_2rem] items-center gap-3 px-5 py-3 text-left outline-none transition-colors hover:bg-quiet focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
    chevron: 'size-4 text-faint transition-transform duration-150 motion-reduce:transition-none',
  },
  variants: {
    isOpen: {
      true: { item: 'bg-quiet', chevron: 'rotate-180' },
      false: {},
    },
  },
});
