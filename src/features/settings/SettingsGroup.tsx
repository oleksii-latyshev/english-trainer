import type { ReactNode } from 'react';
import './settings.css';
import './settingsControls.css';

export function SettingsGroup({
  id,
  title,
  children,
}: {
  /** Anchor the sidebar sub-navigation scrolls to. */
  id: string;
  title: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="settings-group" id={id}>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}
