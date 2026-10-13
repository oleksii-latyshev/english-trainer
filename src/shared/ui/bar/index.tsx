import type { VariantProps } from 'tailwind-variants';
import { bar } from './styles';

type Props = VariantProps<typeof bar> & { heightPx: number; className?: string };

export function Bar({ tone, heightPx, className }: Props) {
  return <span className={bar({ tone, className })} style={{ height: heightPx }} />;
}
