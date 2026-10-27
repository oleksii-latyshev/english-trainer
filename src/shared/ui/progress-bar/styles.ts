import { tv } from '@/shared/ui/tv';

export const progressBar = tv({
  slots: {
    track: 'bg-quiet-line block w-full overflow-hidden rounded-full',
    indicator:
      'bg-accent block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
  },
  variants: {
    size: {
      sm: { track: 'h-1.25' },
      md: { track: 'h-2', indicator: 'shadow-glow' },
    },
  },
  defaultVariants: { size: 'sm' },
});
