import { tv } from '@/shared/ui/tv';

export const navItem = tv({
  slots: {
    root: 'relative flex cursor-pointer items-center whitespace-nowrap rounded-nav border-0 bg-transparent text-left text-quiet-foreground outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 enabled:hover:bg-surface-2 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none',
    icon: 'flex svg:size-4.5 shrink-0 items-center',
    label: 'max-rail:hidden',
    badge:
      'ml-auto rounded-full bg-accent px-2 py-0.5 font-semibold text-caption text-on-accent max-rail:absolute max-rail:top-1 max-rail:right-1.5 max-rail:min-w-4 max-rail:px-1 max-rail:py-px max-rail:text-center max-rail:text-pip max-rail:leading-3.5',
    badgeSuffix: 'max-rail:hidden',
  },
  variants: {
    level: {
      main: { root: 'h-9.5 gap-2.5 px-3 text-control max-rail:justify-center max-rail:px-0' },
      sub: { root: 'h-8.5 px-3 text-caption max-rail:hidden' },
    },
    active: {
      true: {
        root: 'font-semibold text-foreground shadow-nav-active',
        icon: 'text-accent',
      },
      false: '',
    },
  },
  compoundVariants: [
    { level: 'main', active: true, class: { root: 'bg-accent-soft' } },
    { level: 'sub', active: true, class: { root: 'bg-surface-3' } },
  ],
  defaultVariants: { level: 'main', active: false },
});
