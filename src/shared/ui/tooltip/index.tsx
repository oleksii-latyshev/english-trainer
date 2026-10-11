import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactNode } from 'react';
import { tooltip } from './styles';

const { trigger, positioner, popup } = tooltip();

type Props = { content: ReactNode; className?: string; children: ReactNode };

export function Tooltip({ content, className, children }: Props) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger
        closeDelay={500}
        delay={1500}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled child cannot take focus, so the wrapper carries the tooltip
        render={<span className={trigger({ className })} tabIndex={0} />}
      >
        {children}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner className={positioner()} sideOffset={3}>
          <BaseTooltip.Popup className={popup()}>{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
