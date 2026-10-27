import { tv } from '@/shared/ui/tv';

export const swatch = tv({
  base: 'inset-ring-foreground/20 focus-visible:outline-accent aria-pressed:shadow-glow aria-pressed:ring-accent aria-pressed:ring-offset-background flex-none cursor-pointer inset-ring transition duration-150 ease-in-out outline-none focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default disabled:opacity-35 aria-pressed:ring-2 aria-pressed:ring-offset-2 motion-reduce:transition-none',
  variants: {
    shape: {
      body: 'rounded-swatch-body h-7.5 w-9',
      dot: 'size-7.5 rounded-full',
      leaf: 'rounded-swatch-leaf h-6 w-9.5',
    },
  },
  defaultVariants: { shape: 'dot' },
});
