import { tv } from '@/shared/ui/tv';

export const tooltip = tv({
  slots: {
    trigger:
      'focus-visible:ring-accent focus-visible:ring-offset-background inline-block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    positioner: 'z-50',
    popup:
      'border-line bg-overlay shadow-overlay backdrop-blur-glass max-w-xs origin-(--transform-origin) rounded-xl border p-2 text-xs break-all backdrop-saturate-170 transition duration-150 ease-in-out data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-90 data-starting-style:opacity-0 motion-reduce:transition-none',
  },
});
