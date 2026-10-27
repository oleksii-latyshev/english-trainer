import { tv } from '@/shared/ui/tv';

export const navItem = tv({
  slots: {
    root: 'rounded-nav text-quiet-foreground focus-visible:outline-accent enabled:hover:bg-surface-2 relative flex cursor-pointer items-center border-0 bg-transparent text-left whitespace-nowrap transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none',
    icon: 'svg:size-4.5 flex shrink-0 items-center',
    label: 'max-rail:hidden',
    badge:
      'bg-accent text-caption text-on-accent max-rail:absolute max-rail:top-1 max-rail:right-1.5 max-rail:min-w-4 max-rail:px-1 max-rail:py-px max-rail:text-center max-rail:text-pip max-rail:leading-3.5 ml-auto rounded-full px-2 py-0.5 font-semibold',
    badgeSuffix: 'max-rail:hidden',
  },
  variants: {
    level: {
      main: { root: 'text-control max-rail:justify-center max-rail:px-0 h-9.5 gap-2.5 px-3' },
      sub: { root: 'text-caption max-rail:hidden h-8.5 px-3' },
    },
    active: {
      true: {
        root: 'text-foreground shadow-nav-active font-semibold',
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
