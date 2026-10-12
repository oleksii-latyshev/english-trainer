import { tv } from '@/shared/ui/tv';

export const switchControl = tv({
  slots: {
    root: 'group flex cursor-pointer items-center justify-between gap-3',
    text: 'cursor-pointer select-none font-medium text-body text-foreground',
    control:
      'relative flex h-6.5 w-10.5 shrink-0 cursor-pointer items-center rounded-full bg-surface-3 outline-none transition-colors duration-250 ease-out focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-checked:bg-accent data-checked:shadow-glow motion-reduce:transition-none',
    thumb:
      'ms-0.5 size-5.5 rounded-full bg-knob shadow-knob transition-transform duration-300 ease-fluid data-checked:translate-x-4 motion-reduce:transition-none',
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
