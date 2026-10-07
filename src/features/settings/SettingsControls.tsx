import type { ButtonHTMLAttributes } from 'react';

export function SettingsButton({
  variant = 'default',
  type = 'button',
  ...rest
}: { variant?: 'default' | 'ghost' } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return <button className="settings-button" data-variant={variant} type={type} {...rest} />;
}

export function Switch({
  label,
  checked,
  onChange,
  isDisabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isDisabled?: boolean;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className="settings-switch"
      disabled={isDisabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    />
  );
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  isDisabled = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  /** Undefined when the stored value is not one of the options. */
  value: T | undefined;
  onChange: (value: T) => void;
  isDisabled?: boolean;
}) {
  return (
    <fieldset className="settings-segment">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          disabled={isDisabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
