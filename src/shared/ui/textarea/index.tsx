import type { ComponentProps } from 'react';
import { textarea } from './styles';

type Props = Omit<ComponentProps<'textarea'>, 'className'> & { className?: string };

export function Textarea({ className, rows = 2, ...rest }: Props) {
  return <textarea className={textarea({ className })} rows={rows} {...rest} />;
}
