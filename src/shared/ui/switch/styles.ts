import { tv } from '@/shared/ui/tv';

export const switchControl = tv({
  slots: {
    root: 'group flex cursor-pointer items-center justify-between gap-3',
    text: 'text-body text-foreground cursor-pointer font-medium select-none',
    control:
      'bg-surface-3 focus-visible:ring-accent focus-visible:ring-offset-background data-checked:bg-accent data-checked:shadow-glow relative flex h-6.5 w-10.5 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-250 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none',
    thumb:
      'bg-knob shadow-knob ease-fluid ms-0.5 size-5.5 rounded-full transition-transform duration-300 data-checked:translate-x-4 motion-reduce:transition-none',
  },
  variants: {
    disabled: {
      true: { root: 'pointer-events-none opacity-50' },
      false: {},
    },
    isLabelHidden: {
      true: { text: 'sr-only' },
      false: {},
    },
  },
  defaultVariants: { disabled: false, isLabelHidden: false },
});
