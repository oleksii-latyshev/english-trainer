import type { ChangeEvent } from 'react';
import { nativeSelect } from './styles';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  id: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function NativeSelect<T extends string>({
  id,
  options,
  value,
  onChange,
  disabled = false,
}: Props<T>) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const chosen = options.find((option) => option.value === event.target.value);
    if (chosen) onChange(chosen.value);
  }

  return (
    <select
      className={nativeSelect()}
      disabled={disabled}
      id={id}
      onChange={handleChange}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
