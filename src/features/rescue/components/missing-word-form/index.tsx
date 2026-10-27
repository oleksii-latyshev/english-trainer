import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

type Props = {
  description: string;
  onChange: (description: string) => void;
  onFind: () => void;
};

const DESCRIPTION_ID = 'rescue-description';
const MAX_DESCRIPTION_CHARS = 300;

export function MissingWordForm({ description, onChange, onFind }: Props) {
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        onFind();
      }}
    >
      <label className="text-faint basis-full text-xs" htmlFor={DESCRIPTION_ID}>
        Describe the word in English
      </label>
      <Input
        autoComplete="off"
        className="min-w-32 flex-1"
        id={DESCRIPTION_ID}
        maxLength={MAX_DESCRIPTION_CHARS}
        onChange={(event) => onChange(event.target.value)}
        value={description}
      />
      <Button disabled={description.trim() === ''} size="sm" tone="secondary" type="submit">
        Find a word
      </Button>
    </form>
  );
}
