import { tv } from '@/shared/ui/tv';

export const listGroup = tv({
  base: 'overflow-hidden rounded-2xl border border-line bg-surface shadow-overlay backdrop-blur-glass backdrop-saturate-170',
});

export const listRow = tv({
  slots: {
    root: 'relative flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left before:absolute before:top-0 before:right-0 before:h-px before:bg-line-soft first:before:hidden',
    copy: 'flex min-w-0 flex-col',
    title: 'font-medium text-control',
    badge: 'ml-1 font-normal text-accent-text text-xs',
    subtitle: 'mt-0.5 text-faint text-xs',
    trailing: 'ml-auto flex flex-none items-center gap-1.5 text-control text-muted',
  },
  variants: {
    inset: {
      true: { root: 'before:left-14' },
      false: { root: 'before:left-4' },
    },
  },
  defaultVariants: { inset: false },
});

export const listFootnote = tv({
  base: 'px-4 text-faint text-xs leading-copy',
});

export const listAction = tv({
  base: 'relative flex min-h-13 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left font-medium text-accent-text text-control outline-none before:absolute before:top-0 before:right-0 before:left-4 before:h-px before:bg-line-soft first:before:hidden hover:bg-quiet focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent',
});
