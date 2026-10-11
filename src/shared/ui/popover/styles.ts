import { tv } from '@/shared/ui/tv';

export const popover = tv({
  slots: {
    positioner: 'z-50',
    popup:
      'origin-(--transform-origin) rounded-3xl border border-line bg-overlay p-4 text-sm shadow-overlay outline-none backdrop-blur-glass backdrop-saturate-170 transition duration-150 ease-in-out data-ending-style:scale-95 data-starting-style:scale-90 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-100 motion-reduce:transition-none',
  },
});
