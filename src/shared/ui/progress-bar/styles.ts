import { tv } from '@/shared/ui/tv';

export const progressBar = tv({
  slots: {
    track: 'block w-full overflow-hidden rounded-full bg-quiet-line',
    indicator:
      'block h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none',
  },
  variants: {
    size: {
      sm: { track: 'h-1.25' },
      md: { track: 'h-2', indicator: 'shadow-glow' },
    },
  },
  defaultVariants: { size: 'sm' },
});
