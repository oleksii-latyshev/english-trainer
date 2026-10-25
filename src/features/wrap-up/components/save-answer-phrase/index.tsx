import { useAtom, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Bookmark } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { answerKey } from '../../helpers/answer-key';
import { phraseToSave } from '../../helpers/answer-phrase';
import { answerSavedAtom, saveAnswerAtom } from '../../model/atoms';
import type { AnswerFeedback } from '../../types';

type Props = {
  sessionId: number;
  sequence: number;
  feedback: AnswerFeedback;
};

type Label = 'Save phrase' | 'Saving…' | 'Saved to Memory' | 'Retry saving phrase';

function labelOf(isSaved: boolean, isSaving: boolean, hasFailed: boolean): Label {
  if (isSaving) return 'Saving…';
  if (isSaved) return 'Saved to Memory';
  return hasFailed ? 'Retry saving phrase' : 'Save phrase';
}

export function SaveAnswerPhrase({ sessionId, sequence, feedback }: Props) {
  const key = answerKey(sessionId, sequence);
  const isSaved = useAtomValue(answerSavedAtom(key));
  const [result, save] = useAtom(saveAnswerAtom(key));
  const toSave = phraseToSave(feedback);
  if (toSave === null) return null;
  const isSaving = AsyncResult.isWaiting(result);
  const hasFailed = AsyncResult.isFailure(result) && !isSaving;
  return (
    <Button
      aria-pressed={isSaved}
      disabled={isSaving || isSaved}
      onClick={() => save({ sessionId, sequence, ...toSave })}
      size="sm"
      tone="secondary"
    >
      <Bookmark aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
      {labelOf(isSaved, isSaving, hasFailed)}
    </Button>
  );
}
