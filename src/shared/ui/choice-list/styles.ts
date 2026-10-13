import { tv } from '@/shared/ui/tv';

export const choiceList = tv({
  slots: {
    radio:
      'flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset data-disabled:cursor-default data-disabled:opacity-60',
    check: 'ml-auto flex-none text-accent',
  },
});
