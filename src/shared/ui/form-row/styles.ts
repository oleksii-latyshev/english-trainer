import { tv } from '@/shared/ui/tv';

export const formRow = tv({
  slots: {
    root: 'flex items-center gap-4 border-line border-t px-5 py-3.5 max-narrow:flex-wrap',
    copy: 'min-w-0',
    title: 'block text-body',
    description: 'mt-0.75 block text-caption text-muted leading-copy',
    control: 'ml-auto flex flex-none items-center gap-2',
  },
});
