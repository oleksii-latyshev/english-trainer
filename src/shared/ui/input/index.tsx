import { Input as BaseInput } from '@base-ui/react/input';
import { input } from './styles';

type Props = Omit<BaseInput.Props, 'className' | 'render'> & { className?: string };

export function Input({ className, ...rest }: Props) {
  return <BaseInput className={input({ className })} {...rest} />;
}
