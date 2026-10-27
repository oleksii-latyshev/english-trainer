import { tv } from '@/shared/ui/tv';

export const alertDialog = tv({
  slots: {
    backdrop:
      'bg-backdrop fixed inset-0 z-50 transition-opacity duration-150 ease-out data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:opacity-0 motion-reduce:transition-none',
    viewport: 'fixed inset-0 z-50 flex items-center justify-center p-10',
    popup:
      'border-line bg-overlay shadow-overlay backdrop-blur-glass relative flex max-h-full min-h-0 w-full max-w-md flex-col overflow-clip rounded-3xl border p-6 backdrop-saturate-170 transition duration-250 ease-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-105 data-starting-style:opacity-0 motion-reduce:transition-none',
    header: 'flex flex-col gap-3',
    icon: 'flex size-10 shrink-0 items-center justify-center rounded-3xl select-none',
    title: 'text-foreground align-middle text-base font-medium',
    body: 'text-muted mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain p-0.75 text-sm',
    footer: 'mt-5 flex flex-row items-center justify-end gap-2',
  },
  variants: {
    tone: {
      neutral: { icon: 'bg-surface-3 text-foreground' },
      danger: { icon: 'bg-danger-soft text-danger-text' },
    },
  },
  defaultVariants: { tone: 'neutral' },
});
