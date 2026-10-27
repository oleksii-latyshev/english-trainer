import { tv } from '@/shared/ui/tv';

export const cardButton = tv({
  base: 'rounded-nav border-line bg-surface focus-visible:outline-accent enabled:hover:bg-surface-2 flex w-full cursor-pointer flex-col gap-2 border p-3 text-left transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none',
});
