import { tv } from '@/shared/ui/tv';

export const tooltip = tv({
  slots: {
    trigger:
      'inline-block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    positioner: 'z-50',
    popup:
      'max-w-xs origin-(--transform-origin) break-all rounded-xl border border-line bg-overlay p-2 text-xs shadow-overlay backdrop-blur-glass backdrop-saturate-170 transition duration-150 ease-in-out data-ending-style:scale-95 data-starting-style:scale-90 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-100 motion-reduce:transition-none',
  },
});
