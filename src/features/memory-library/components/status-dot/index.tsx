import type { VariantProps } from 'tailwind-variants';
import { statusDot } from './styles';

type Props = Required<VariantProps<typeof statusDot>> & { className?: string };

export function StatusDot({ status, className }: Props) {
  return <span aria-hidden="true" className={statusDot({ status, className })} />;
}
