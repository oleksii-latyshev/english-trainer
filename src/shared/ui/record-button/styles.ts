import { tv } from '@/shared/ui/tv';

export const recordButton = tv({
  base: 'svg:pointer-events-none relative inline-flex size-14 svg:size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border outline-none transition duration-150 ease-out focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-97 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none',
  variants: {
    state: {
      ready:
        'border-control-line bg-surface-3 text-foreground shadow-control enabled:hover:bg-surface-3',
      live: 'border-transparent bg-accent text-on-accent shadow-glow ring-6 ring-accent-soft',
      busy: 'border-control-line bg-surface-2 text-muted',
    },
  },
  defaultVariants: { state: 'ready' },
});
