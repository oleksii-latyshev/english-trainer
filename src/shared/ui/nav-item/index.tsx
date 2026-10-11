import { Button as BaseButton } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { navItem } from './styles';

type Props = VariantProps<typeof navItem> &
  Omit<BaseButton.Props, 'className' | 'render' | 'children'> & {
    icon?: ReactNode;
    badge?: { count: number; suffix: string };
    children: ReactNode;
  };

const CURRENT_BY_LEVEL = { main: 'page', sub: 'true' } as const;

export function NavItem({ level, active = false, icon, badge, children, ...rest }: Props) {
  const slots = navItem({ level, active });
  return (
    <BaseButton
      aria-current={active ? CURRENT_BY_LEVEL[level ?? 'main'] : undefined}
      className={slots.root()}
      type="button"
      {...rest}
    >
      {icon && (
        <span aria-hidden="true" className={slots.icon()}>
          {icon}
        </span>
      )}
      <span className={slots.label()}>{children}</span>
      {badge && (
        <span aria-hidden="true" className={slots.badge()}>
          {badge.count}
          <span className={slots.badgeSuffix()}>{badge.suffix}</span>
        </span>
      )}
    </BaseButton>
  );
}
