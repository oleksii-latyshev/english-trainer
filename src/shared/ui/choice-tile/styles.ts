import { tv } from '@/shared/ui/tv';

export const choiceTile = tv({
  base: 'flex cursor-pointer flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center outline-none transition duration-150 ease-in-out hover:bg-quiet focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-pressed:bg-accent-soft aria-pressed:shadow-nav-active motion-reduce:transition-none',
});
