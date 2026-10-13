import { tv } from '@/shared/ui/tv';

export const choiceChip = tv({
  base: 'inline-flex h-8.5 cursor-pointer items-center whitespace-nowrap rounded-full border border-quiet-line bg-quiet px-3.5 font-semibold text-control text-quiet-foreground outline-none transition duration-150 ease-in-out hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-50 aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-foreground motion-reduce:transition-none',
});
