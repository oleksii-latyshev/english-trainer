import { tv } from '@/shared/ui/tv';

export const formRow = tv({
  slots: {
    root: 'flex items-center gap-4 border-line-soft border-t px-5 py-3 first:border-t-0 max-narrow:flex-wrap',
    copy: 'min-w-0',
    title: 'block font-semibold text-control',
    description: 'mt-0.75 block text-muted text-xs leading-copy',
    control: 'ml-auto flex flex-none items-center gap-2',
  },
});
