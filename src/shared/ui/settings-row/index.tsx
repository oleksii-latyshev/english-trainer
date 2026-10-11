import type { FormEventHandler, ReactNode } from 'react';
import './styles.css';

type Props = {
  title: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  children?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function SettingsRow({ title, htmlFor, description, children, onSubmit }: Props) {
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
