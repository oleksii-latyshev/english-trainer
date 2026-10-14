import { Button as BaseButton } from '@base-ui/react/button';
import type { VariantProps } from 'tailwind-variants';
import { recordButton } from './styles';

type Props = VariantProps<typeof recordButton> &
  Omit<BaseButton.Props, 'className' | 'render'> & { className?: string };

export function RecordButton({ state, className, type = 'button', ...rest }: Props) {
  return (
    <BaseButton
      className={recordButton({ state, className })}
      data-state={state ?? 'ready'}
      type={type}
      {...rest}
    />
  );
}
