import { useAtom } from '@effect/atom-react';
import type { FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { draftAtom } from '../../model/atoms';

type Props = {
  said: string;
  draftKey: string;
  isSaving: boolean;
  onSubmit: (answer: string) => void;
};

export function FixAnswer({ said, draftKey, isSaving, onSubmit }: Props) {
  const [draft, setDraft] = useAtom(draftAtom(draftKey));
  const value = draft[0] ?? said;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim() !== '' && !isSaving) onSubmit(value.trim());
  }

  return (
    <form className="flex w-full max-w-xl flex-col items-center gap-6" onSubmit={submit}>
      <Textarea
        aria-label="Your corrected sentence"
        disabled={isSaving}
        onChange={(event) => setDraft([event.target.value])}
        rows={3}
        value={value}
      />
      <Button
        disabled={value.trim() === '' || isSaving}
        pending={isSaving}
        tone="primary"
        type="submit"
      >
        Submit
      </Button>
    </form>
  );
}
