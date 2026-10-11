import { Toast } from '@base-ui/react/toast';
import { Button } from '@/shared/ui/button';
import { StatusIcon } from '@/shared/ui/status-icon';
import { toastManager } from './manager';

export { toast } from './manager';

import { toastStyles } from './styles';

const TIMEOUT_MS = 4000;

function isTone(type: string | undefined): type is 'success' | 'danger' {
  return type === 'success' || type === 'danger';
}

function statusOf(type: string | undefined) {
  return type === 'success' || type === 'danger' ? type : 'info';
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => {
    const tone = isTone(item.type) ? item.type : 'neutral';
    const { root, indicator, content, title, close } = toastStyles({ tone });
    return (
      <Toast.Root className={root()} key={item.id} toast={item}>
        <div className={indicator()}>
          <StatusIcon status={statusOf(item.type)} />
        </div>
        <Toast.Content className={content()}>
          <Toast.Title className={title()} />
        </Toast.Content>
        {item.actionProps?.children && (
          <Toast.Action render={<Button size="sm" tone="primary" />} />
        )}
        <Toast.Close aria-label="Close" className={close()}>
          <svg aria-hidden="true" fill="none" height={12} viewBox="0 0 16 16" width={12}>
            <path
              clipRule="evenodd"
              d="M3.47 3.47a.75.75 0 0 1 1.06 0L8 6.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L9.06 8l3.47 3.47a.75.75 0 1 1-1.06 1.06L8 9.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L6.94 8 3.47 4.53a.75.75 0 0 1 0-1.06Z"
              fill="currentColor"
              fillRule="evenodd"
            />
          </svg>
        </Toast.Close>
      </Toast.Root>
    );
  });
}

export function ToastProvider() {
  const { viewport } = toastStyles();
  return (
    <Toast.Provider timeout={TIMEOUT_MS} toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className={viewport()}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
