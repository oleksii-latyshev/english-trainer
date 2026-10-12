import { tv } from '@/shared/ui/tv';

export const segmentedControl = tv({
  slots: {
    root: 'inline-flex w-max gap-0.5 rounded-full border border-control-line bg-surface-2 p-0.75',
    item: 'flex cursor-pointer items-center whitespace-nowrap rounded-full font-semibold text-muted outline-none transition duration-150 ease-in-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default data-pressed:bg-surface-3 data-pressed:text-foreground data-pressed:shadow-control motion-reduce:transition-none',
  },
  variants: {
    size: {
      sm: { item: 'h-7 px-2.75 text-xs' },
      md: { item: 'h-7.5 px-3.5 text-caption' },
    },
    disabled: {
      true: { root: 'opacity-50' },
      false: {},
    },
  },
  defaultVariants: { size: 'sm', disabled: false },
});
