import type { FormEventHandler, ReactNode } from 'react';
import { formRow } from './styles';

const { root, copy, title, description, control } = formRow();

type Props = {
  title: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  children?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function FormRowTitle({ children }: { children: ReactNode }) {
  return <span className={title()}>{children}</span>;
}

export function FormRowDescription({ children }: { children: ReactNode }) {
  return <span className={description()}>{children}</span>;
}

export function FormRow({ title: heading, htmlFor, description: hint, children, onSubmit }: Props) {
  const label = htmlFor ? (
    <label className={title()} htmlFor={htmlFor}>
      {heading}
    </label>
  ) : (
    <FormRowTitle>{heading}</FormRowTitle>
  );
  const body = (
    <>
      <div className={copy()}>
        {label}
        {hint && <div className={description()}>{hint}</div>}
      </div>
      {children && <div className={control()}>{children}</div>}
    </>
  );
  if (onSubmit) {
    return (
      <form className={root()} data-slot="form-row" onSubmit={onSubmit}>
        {body}
      </form>
    );
  }
  return (
    <div className={root()} data-slot="form-row">
      {body}
    </div>
  );
}
