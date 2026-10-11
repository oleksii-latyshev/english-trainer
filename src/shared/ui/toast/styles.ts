import { tv } from '@/shared/ui/tv';

export const toastStyles = tv({
  slots: {
    viewport:
      'pointer-events-none fixed bottom-4 left-1/2 z-60 flex w-115 -translate-x-1/2 flex-col-reverse gap-3 outline-none',
    root: 'group pointer-events-auto relative flex w-full flex-row items-start justify-start gap-1.5 rounded-3xl border border-line bg-overlay px-4 py-3 shadow-overlay outline-none backdrop-blur-glass backdrop-saturate-170 transition duration-300 ease-fluid focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-ending-style:translate-y-full data-starting-style:translate-y-full data-ending-style:opacity-0 data-ending-style:duration-250 motion-reduce:transition-none',
    indicator: 'flex shrink-0 select-none items-center justify-center p-1',
    content: 'flex grow flex-col items-start self-center',
    title: 'font-medium text-sm leading-5',
    action: '',
    close:
      'absolute -top-1 -right-1 flex size-5 cursor-pointer items-center justify-center rounded-xl border border-line bg-overlay p-1 text-muted opacity-0 outline-none transition-opacity duration-150 ease-in-out hover:bg-surface-3 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 motion-reduce:transition-none',
  },
  variants: {
    tone: {
      neutral: { title: 'text-foreground', indicator: 'text-foreground' },
      success: { title: 'text-ok-text', indicator: 'text-ok-text' },
      danger: { title: 'text-danger-text', indicator: 'text-danger-text' },
    },
  },
  defaultVariants: { tone: 'neutral' },
});
