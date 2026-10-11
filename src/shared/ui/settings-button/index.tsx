import type { ButtonHTMLAttributes } from 'react';
import './styles.css';

type Props = {
  variant?: 'default' | 'ghost';
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

export function SettingsButton({ variant = 'default', type = 'button', ...rest }: Props) {
  return <button className="settings-button" data-variant={variant} type={type} {...rest} />;
}
