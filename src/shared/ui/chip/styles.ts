import { tv } from '@/shared/ui/tv';

export const chip = tv({
  slots: {
    root: 'inline-flex w-fit shrink-0 items-center gap-0.5 rounded-full border font-semibold whitespace-nowrap',
    label: 'px-0.5',
  },
  variants: {
    tone: {
      neutral: { root: 'border-quiet-line bg-quiet text-quiet-foreground' },
      sky: { root: 'border-accent-line bg-accent-soft text-foreground' },
      success: { root: 'border-ok-line bg-ok-soft text-ok-text' },
      warning: { root: 'border-warn-line bg-warn-soft text-warn-text' },
    },
    size: {
      sm: { root: 'px-1.5 text-xs leading-5' },
      md: { root: 'text-control h-8 px-3.5' },
    },
  },
  defaultVariants: { tone: 'neutral', size: 'sm' },
});
