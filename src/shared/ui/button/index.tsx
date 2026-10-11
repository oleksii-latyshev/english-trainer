import { Button as BaseButton } from '@base-ui/react/button';
import type { VariantProps } from 'tailwind-variants';
import { button } from './styles';

type Props = VariantProps<typeof button> &
  Omit<BaseButton.Props, 'className' | 'render'> & { className?: string };

export function Button({ tone, className, type = 'button', ...rest }: Props) {
  return <BaseButton className={button({ tone, className })} type={type} {...rest} />;
}
