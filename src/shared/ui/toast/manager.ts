import { Toast } from '@base-ui/react/toast';

type ToastTone = 'neutral' | 'success' | 'danger';

type Options = { action?: { label: string; onClick: () => void } };

export const toastManager = Toast.createToastManager();

function show(tone: ToastTone, title: string, options?: Options): string {
  return toastManager.add({
    title,
    type: tone,
    actionProps: options?.action && {
      children: options.action.label,
      onClick: options.action.onClick,
    },
  });
}

export const toast = Object.assign(
  (title: string, options?: Options) => show('neutral', title, options),
  {
    success: (title: string, options?: Options) => show('success', title, options),
    danger: (title: string, options?: Options) => show('danger', title, options),
    close: (id: string) => toastManager.close(id),
  },
);
