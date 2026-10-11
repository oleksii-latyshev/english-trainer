import { Input as BaseInput } from '@base-ui/react/input';
import { searchField } from './styles';

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
};

export function SearchField({ value, onValueChange, label, placeholder, className }: Props) {
  const { root, group, icon, input, clear } = searchField({ empty: value === '' });
  return (
    <div className={root({ className })} data-slot="search-field">
      <div className={group()}>
        <svg
          aria-hidden="true"
          className={icon()}
          fill="none"
          height={16}
          viewBox="0 0 16 16"
          width={16}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            clipRule="evenodd"
            d="M11.5 7a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0m-.82 4.74a6 6 0 1 1 1.06-1.06l2.79 2.79a.75.75 0 1 1-1.06 1.06z"
            fill="currentColor"
            fillRule="evenodd"
          />
        </svg>
        <BaseInput
          aria-label={label}
          className={input()}
          onValueChange={onValueChange}
          placeholder={placeholder}
          type="search"
          value={value}
        />
        <button
          aria-label="Clear search"
          className={clear()}
          onClick={() => onValueChange('')}
          tabIndex={-1}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height={12} viewBox="0 0 16 16" width={12}>
            <path
              clipRule="evenodd"
              d="M3.47 3.47a.75.75 0 0 1 1.06 0L8 6.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L9.06 8l3.47 3.47a.75.75 0 1 1-1.06 1.06L8 9.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L6.94 8 3.47 4.53a.75.75 0 0 1 0-1.06Z"
              fill="currentColor"
              fillRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
