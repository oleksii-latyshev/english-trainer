import { Button as BaseButton } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { cardButton } from './styles';

type Props = Omit<BaseButton.Props, 'render' | 'children'> & {
  children: ReactNode;
};

export function CardButton({ className, children, ...rest }: Props) {
  return (
    <BaseButton className={cardButton({ className: className as string })} type="button" {...rest}>
      {children}
    </BaseButton>
  );
}
