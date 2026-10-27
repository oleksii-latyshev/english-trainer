import { tv } from '@/shared/ui/tv';

export const popover = tv({
  slots: {
    positioner: 'z-50',
    popup:
      'border-line bg-overlay shadow-overlay backdrop-blur-glass origin-(--transform-origin) rounded-3xl border p-4 text-sm backdrop-saturate-170 transition duration-150 ease-in-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-90 data-starting-style:opacity-0 motion-reduce:transition-none',
  },
});
