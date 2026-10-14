import { tv } from '@/shared/ui/tv';

export const outcomeTone = tv({
  base: 'text-caption',
  variants: {
    outcome: {
      used: 'text-ok-text',
      'not-yet': 'text-muted',
      skipped: 'text-muted',
    },
  },
});
