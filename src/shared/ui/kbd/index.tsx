import type { ComponentProps } from 'react';
import { kbd } from './styles';

type Props = Omit<ComponentProps<'kbd'>, 'ref'>;

export function Kbd({ className, ...rest }: Props) {
  return <kbd className={kbd({ className })} {...rest} />;
}
