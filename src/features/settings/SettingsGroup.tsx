import type { FormEventHandler, ReactNode } from 'react';
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

type RowProps = {
  title: ReactNode;
  /** Makes the title the label of the control with this id. */
  htmlFor?: string;
  description?: ReactNode;
  /** The control, aligned to the right. */
  children?: ReactNode;
  /** Renders the row as a form so Enter submits it. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function SettingsRow({ title, htmlFor, description, children, onSubmit }: RowProps) {
  const copy = (
    <div className="settings-row-copy">
      {htmlFor ? (
        <label className="settings-row-title" htmlFor={htmlFor}>
          {title}
        </label>
      ) : (
        <div className="settings-row-title">{title}</div>
      )}
      {description && <div className="settings-row-description">{description}</div>}
    </div>
  );
  const control = children && <div className="settings-row-control">{children}</div>;
  if (onSubmit) {
    return (
      <form className="settings-row" onSubmit={onSubmit}>
        {copy}
        {control}
      </form>
    );
  }
  return (
    <div className="settings-row">
      {copy}
      {control}
    </div>
  );
}

/** A full-width row for content that does not fit the title and control layout. */
export function SettingsBlock({
  tone = 'plain',
  role,
  children,
}: {
  tone?: 'plain' | 'quiet' | 'warn' | 'error';
  role?: 'alert' | 'status';
  children: ReactNode;
}) {
  return (
    <div className="settings-block" data-tone={tone} role={role}>
      {children}
    </div>
  );
}
