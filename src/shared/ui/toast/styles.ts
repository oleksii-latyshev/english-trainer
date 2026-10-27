import { tv } from '@/shared/ui/tv';

export const toastStyles = tv({
  slots: {
    viewport:
      'pointer-events-none fixed bottom-4 left-1/2 z-60 flex w-115 -translate-x-1/2 flex-col-reverse gap-3 outline-none',
    root: 'group border-line bg-overlay shadow-overlay backdrop-blur-glass ease-fluid focus-visible:ring-accent focus-visible:ring-offset-background pointer-events-auto relative flex w-full flex-row items-start justify-start gap-1.5 rounded-3xl border px-4 py-3 backdrop-saturate-170 transition duration-300 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-ending-style:translate-y-full data-ending-style:opacity-0 data-ending-style:duration-250 data-starting-style:translate-y-full motion-reduce:transition-none',
    indicator: 'flex shrink-0 items-center justify-center p-1 select-none',
    content: 'flex grow flex-col items-start self-center',
    title: 'text-sm leading-5 font-medium',
    action: '',
    close:
      'border-line bg-overlay text-muted hover:bg-surface-3 focus-visible:ring-accent absolute -top-1 -right-1 flex size-5 cursor-pointer items-center justify-center rounded-xl border p-1 opacity-0 transition-opacity duration-150 ease-in-out outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 motion-reduce:transition-none',
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
