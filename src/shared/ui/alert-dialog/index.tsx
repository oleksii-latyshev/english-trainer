import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import type { ReactNode } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { StatusIcon } from '@/shared/ui/status-icon';
import { alertDialog } from './styles';

type Props = VariantProps<typeof alertDialog> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  actions: ReactNode;
  className?: string;
  children: ReactNode;
};

export function AlertDialog({
  open,
  onOpenChange,
  tone,
  title,
  actions,
  className,
  children,
}: Props) {
  const {
    backdrop,
    viewport,
    popup,
    header,
    icon,
    title: heading,
    body,
    footer,
  } = alertDialog({
    tone,
  });
  return (
    <BaseAlertDialog.Root onOpenChange={onOpenChange} open={open}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className={backdrop()} />
        <BaseAlertDialog.Viewport className={viewport()}>
          <BaseAlertDialog.Popup className={popup({ className })}>
            <div className={header()}>
              {tone === 'danger' && (
                <div className={icon()}>
                  <StatusIcon className="size-5" status="danger" />
                </div>
              )}
              <BaseAlertDialog.Title className={heading()}>{title}</BaseAlertDialog.Title>
            </div>
            <BaseAlertDialog.Description className={body()} render={<div />}>
              {children}
            </BaseAlertDialog.Description>
            <div className={footer()}>{actions}</div>
          </BaseAlertDialog.Popup>
        </BaseAlertDialog.Viewport>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}
