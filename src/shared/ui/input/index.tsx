import { Input as BaseInput } from '@base-ui/react/input';
import type { VariantProps } from 'tailwind-variants';
import { input } from './styles';

type Props = VariantProps<typeof input> &
  Omit<BaseInput.Props, 'className' | 'render'> & { className?: string };

export function Input({ appearance, className, ...rest }: Props) {
  return <BaseInput className={input({ appearance, className })} {...rest} />;
}
