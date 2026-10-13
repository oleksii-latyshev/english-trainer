import { Button as BaseButton } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { listAction, listFootnote, listGroup, listRow } from './styles';

const { root, copy, title: titleSlot, badge, subtitle: subtitleSlot, trailing } = listRow();

type GroupProps = { className?: string; children: ReactNode };

export function ListGroup({ className, children }: GroupProps) {
  return <div className={listGroup({ className })}>{children}</div>;
}

type TextProps = { title: ReactNode; subtitle?: ReactNode; badge?: string };

export function ListRowText({ title, subtitle, badge: badgeText }: TextProps) {
  return (
    <span className={copy()}>
      <span className={titleSlot()}>
        {title}
        {badgeText && <span className={badge()}>{badgeText}</span>}
      </span>
      {subtitle && <span className={subtitleSlot()}>{subtitle}</span>}
    </span>
  );
}

type RowProps = TextProps & {
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function ListRow({ icon, trailing: trailingContent, className, ...text }: RowProps) {
  return (
    <div className={root({ inset: icon !== undefined, className })}>
      {icon}
      <ListRowText {...text} />
      {trailingContent !== undefined && <span className={trailing()}>{trailingContent}</span>}
    </div>
  );
}

type FootnoteProps = { children: ReactNode; className?: string };

export function ListFootnote({ children, className }: FootnoteProps) {
  return <div className={listFootnote({ className })}>{children}</div>;
}

type ActionProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

export function ListActionRow({
  children,
  onClick,
  type = 'button',
  disabled = false,
}: ActionProps) {
  return (
    <BaseButton className={listAction()} disabled={disabled} onClick={onClick} type={type}>
      {children}
    </BaseButton>
  );
}
