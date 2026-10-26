import { tv } from '@/shared/ui/tv';

export const cardButton = tv({
  base: 'flex w-full cursor-pointer flex-col gap-2 rounded-nav border border-line bg-surface p-3 text-left outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 enabled:hover:bg-surface-2 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none',
});
