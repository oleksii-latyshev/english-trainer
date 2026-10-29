import { useAtom } from '@effect/atom-react';
import type { FormEvent } from 'react';
import type { ExerciseView } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { keptGapWords, sentenceParts } from '../../helpers/gap-sentence';
import { draftAtom } from '../../model/atoms';

type Sentence = NonNullable<ExerciseView['sentence']>;

type Props = {
  sentence: Sentence;
  draftKey: string;
  isEditable: boolean;
  isSaving: boolean;
  keep: string | null;
  onSubmit: (answer: string) => void;
};

const SENTENCE =
  'm-0 flex max-w-3xl flex-wrap items-baseline justify-center gap-x-2 gap-y-3 text-3xl leading-snug';

export function GapAnswer({ sentence, draftKey, isEditable, isSaving, keep, onSubmit }: Props) {
  const [draft, setDraft] = useAtom(draftAtom(draftKey));
  const parts = sentenceParts(sentence);
  const gapCount = parts.filter((part) => part.kind === 'gap').length;
  const kept = keep === null ? [] : keptGapWords(sentence, keep);
  const values = Array.from({ length: gapCount }, (_, index) => draft[index] ?? '');
  const isComplete = values.every((value) => value.trim() !== '');

  function change(index: number, value: string) {
    setDraft(values.map((current, at) => (at === index ? value : current)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isComplete && !isSaving) onSubmit(values.map((value) => value.trim()).join(' '));
  }

  return (
    <form className="flex flex-col items-center gap-6" onSubmit={submit}>
      <p className={SENTENCE} data-word-lookup>
        {parts.map((part) => {
          if (part.kind === 'word') return <span key={`w${part.text}`}>{part.text}</span>;
          if (isEditable) {
            return (
              <Input
                appearance="gap"
                aria-label={gapCount === 1 ? 'Missing words' : `Missing words ${part.index + 1}`}
                autoComplete="off"
                disabled={isSaving}
                key={`g${part.index}`}
                onChange={(event) => change(part.index, event.target.value)}
                size={Math.max(part.wordCount * 6, 8)}
                value={values[part.index]}
              />
            );
          }
          return (
            <span className="border-accent border-b-2 px-1 font-semibold" key={`g${part.index}`}>
              {values[part.index] || kept[part.index]}
            </span>
          );
        })}
      </p>
      {isEditable && (
        <Button disabled={!isComplete || isSaving} pending={isSaving} tone="primary" type="submit">
          Submit
        </Button>
      )}
    </form>
  );
}
