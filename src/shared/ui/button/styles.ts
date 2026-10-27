import { tv } from '@/shared/ui/tv';

const control =
  'h-8.5 rounded-full border px-3.5 text-control focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50';

const pill =
  'relative isolate inline-flex w-fit transform-gpu select-none items-center justify-center gap-2 rounded-full border outline-none transition duration-150 ease-out focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-97 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 svg:pointer-events-none svg:size-4 svg:shrink-0';

type PillTone = 'primary' | 'secondary' | 'quiet' | 'outline' | 'danger';

const quietTones: PillTone[] = ['quiet', 'outline'];
const calmTones: PillTone[] = ['secondary', 'quiet', 'outline', 'danger'];

export const button = tv({
  base: 'cursor-pointer whitespace-nowrap',
  variants: {
    tone: {
      neutral: `${control} border-line bg-surface-2 text-foreground enabled:hover:bg-surface-3 font-medium`,
      ghost: `${control} text-muted enabled:hover:bg-surface-2 border-transparent bg-transparent font-medium`,
      primary: `${pill} bg-accent text-on-accent shadow-primary hover:bg-accent-hover border-transparent font-bold`,
      secondary: `${pill} border-control-line bg-surface-2 text-foreground shadow-control hover:bg-surface-3 font-semibold`,
      quiet: `${pill} border-quiet-line bg-quiet text-quiet-foreground hover:bg-surface-2 font-semibold`,
      outline: `${pill} border-control-line text-foreground hover:bg-quiet bg-transparent font-semibold`,
      danger: `${pill} bg-danger text-on-danger hover:bg-danger-hover border-transparent font-semibold`,
    },
    size: { md: '', sm: '' },
    iconOnly: { true: '', false: '' },
  },
  compoundVariants: [
    { tone: 'primary', size: 'md', class: 'text-body h-12 px-6' },
    { tone: 'primary', size: 'sm', class: 'text-control h-9 px-4' },
    { tone: calmTones, size: 'md', class: 'text-control h-10 px-4' },
    { tone: quietTones, size: 'md', class: 'px-3.5' },
    { tone: calmTones, size: 'sm', class: 'text-caption h-8 px-3' },
    { tone: ['primary', ...calmTones], size: 'md', iconOnly: true, class: 'w-10 p-0' },
    { tone: ['primary', ...calmTones], size: 'sm', iconOnly: true, class: 'w-8 p-0' },
  ],
  defaultVariants: { tone: 'neutral', size: 'md', iconOnly: false },
});
