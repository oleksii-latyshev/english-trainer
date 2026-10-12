import { tv } from '@/shared/ui/tv';

export const swatch = tv({
  base: 'inset-ring inset-ring-foreground/20 flex-none cursor-pointer outline-none transition duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4 disabled:cursor-default disabled:opacity-35 aria-pressed:shadow-glow aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-background motion-reduce:transition-none',
  variants: {
    shape: {
      body: 'h-7.5 w-9 rounded-swatch-body',
      dot: 'size-7.5 rounded-full',
      leaf: 'h-6 w-9.5 rounded-swatch-leaf',
    },
  },
  defaultVariants: { shape: 'dot' },
});
