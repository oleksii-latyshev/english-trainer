import { tv } from '@/shared/ui/tv';

export const evidenceTag = tv({
  base: 'flex-none rounded-full px-2 py-0.5 font-bold text-pip',
  variants: {
    tone: {
      own: 'bg-warn text-on-warn',
      slip: 'bg-quiet-line text-quiet-foreground',
    },
  },
});
