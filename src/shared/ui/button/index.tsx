import { Button as BaseButton } from '@base-ui/react/button';
import type { VariantProps } from 'tailwind-variants';
import { button } from './styles';

type Props = VariantProps<typeof button> &
  Omit<BaseButton.Props, 'className' | 'render'> & { className?: string; pending?: boolean };

export function Button({
  tone,
  size,
  iconOnly,
  pending = false,
  className,
  type = 'button',
  onClick,
  ...rest
}: Props) {
  return (
    <BaseButton
      aria-disabled={pending || undefined}
      className={button({ tone, size, iconOnly, className })}
      data-pending={pending || undefined}
      onClick={pending ? undefined : onClick}
      type={type}
      {...rest}
    />
  );
}
