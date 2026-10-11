import { tv } from '@/shared/ui/tv';

export const notice = tv({
  base: 'border-line border-t px-5 py-3.5 leading-normal',
  variants: {
    tone: {
      plain: 'bg-surface text-body text-foreground',
      quiet: 'bg-background text-caption text-muted',
      warn: 'bg-warn-bg text-caption text-warn',
      error: 'bg-warn-bg text-caption text-warn',
    },
  },
  defaultVariants: { tone: 'plain' },
});
