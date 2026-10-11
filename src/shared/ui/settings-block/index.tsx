import type { ReactNode } from 'react';
import './styles.css';

type Props = {
  tone?: 'plain' | 'quiet' | 'warn' | 'error';
  role?: 'alert' | 'status';
  children: ReactNode;
};

export function SettingsBlock({ tone = 'plain', role, children }: Props) {
  return (
    <div className="settings-block" data-tone={tone} role={role}>
      {children}
    </div>
  );
}
