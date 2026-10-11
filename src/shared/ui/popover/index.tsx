import { Popover as BasePopover } from '@base-ui/react/popover';
import type { ReactElement, ReactNode } from 'react';
import { popover } from './styles';

const { positioner, popup } = popover();

type Props = {
  trigger: ReactElement;
  label: string;
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
};

export function Popover({ trigger, label, align = 'center', children }: Props) {
  return (
    <BasePopover.Root>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner align={align} className={positioner()} sideOffset={8}>
          <BasePopover.Popup aria-label={label} className={popup()}>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
