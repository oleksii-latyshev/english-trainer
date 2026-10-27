import { tv } from '@/shared/ui/tv';

export const segmentedControl = tv({
  slots: {
    root: 'border-control-line bg-surface-2 inline-flex w-max gap-0.5 rounded-full border p-0.75',
    item: 'text-muted hover:text-foreground focus-visible:ring-accent focus-visible:ring-offset-background data-pressed:bg-surface-3 data-pressed:text-foreground data-pressed:shadow-control flex cursor-pointer items-center rounded-full font-semibold whitespace-nowrap transition duration-150 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default motion-reduce:transition-none',
  },
  variants: {
    size: {
      sm: { item: 'h-7 px-2.75 text-xs' },
      md: { item: 'text-caption h-7.5 px-3.5' },
    },
    disabled: {
      true: { root: 'opacity-50' },
      false: {},
    },
  },
  defaultVariants: { size: 'sm', disabled: false },
});
