import { tv } from '@/shared/ui/tv';

export const listGroup = tv({
  base: 'border-line bg-surface shadow-overlay backdrop-blur-glass overflow-hidden rounded-2xl border backdrop-saturate-170',
});

export const listRow = tv({
  slots: {
    root: 'before:bg-line-soft relative flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left before:absolute before:top-0 before:right-0 before:h-px first:before:hidden',
    copy: 'flex min-w-0 flex-col',
    title: 'text-control font-medium',
    badge: 'text-accent-text ml-1 text-xs font-normal',
    subtitle: 'text-faint mt-0.5 text-xs',
    trailing: 'text-control text-muted ml-auto flex flex-none items-center gap-1.5',
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
  base: 'text-faint leading-copy px-4 text-xs',
});

export const listAction = tv({
  base: 'text-accent-text text-control before:bg-line-soft hover:bg-quiet focus-visible:ring-accent relative flex min-h-13 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left font-medium outline-none before:absolute before:top-0 before:right-0 before:left-4 before:h-px first:before:hidden focus-visible:ring-2 focus-visible:ring-inset disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent',
});
