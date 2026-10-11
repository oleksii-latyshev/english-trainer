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
      neutral: `${control} border-line bg-surface-2 font-medium text-foreground enabled:hover:bg-surface-3`,
      ghost: `${control} border-transparent bg-transparent font-medium text-muted enabled:hover:bg-surface-2`,
      primary: `${pill} border-transparent bg-accent font-bold text-on-accent shadow-primary hover:bg-accent-hover`,
      secondary: `${pill} border-control-line bg-surface-2 font-semibold text-foreground shadow-control hover:bg-surface-3`,
      quiet: `${pill} border-quiet-line bg-quiet font-semibold text-quiet-foreground hover:bg-surface-2`,
      outline: `${pill} border-control-line bg-transparent font-semibold text-foreground hover:bg-quiet`,
      danger: `${pill} border-transparent bg-danger font-semibold text-on-danger hover:bg-danger-hover`,
    },
    size: { md: '', sm: '' },
    iconOnly: { true: '', false: '' },
  },
  compoundVariants: [
    { tone: 'primary', size: 'md', class: 'h-12 px-6 text-body' },
    { tone: 'primary', size: 'sm', class: 'h-9 px-4 text-control' },
    { tone: calmTones, size: 'md', class: 'h-10 px-4 text-control' },
    { tone: quietTones, size: 'md', class: 'px-3.5' },
    { tone: calmTones, size: 'sm', class: 'h-8 px-3 text-caption' },
    { tone: ['primary', ...calmTones], size: 'md', iconOnly: true, class: 'w-10 p-0' },
    { tone: ['primary', ...calmTones], size: 'sm', iconOnly: true, class: 'w-8 p-0' },
  ],
  defaultVariants: { tone: 'neutral', size: 'md', iconOnly: false },
});
