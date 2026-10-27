import { tv } from '@/shared/ui/tv';

export const formRow = tv({
  slots: {
    root: 'border-line-soft max-narrow:flex-wrap flex items-center gap-4 border-t px-5 py-3 first:border-t-0',
    copy: 'min-w-0',
    title: 'text-control block font-semibold',
    description: 'text-muted leading-copy mt-0.75 block text-xs',
    control: 'ml-auto flex flex-none items-center gap-2',
  },
});
