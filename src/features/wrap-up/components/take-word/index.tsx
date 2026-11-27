import { useAtom, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Bookmark } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { wordKey } from '../../helpers/word-key';
import { takeWordAtom, wordTakenAtom } from '../../model/atoms';

type Props = {
  sessionId: number;
  word: { sequence: number; phrase: string; meaning: string };
};

type Label = 'Take' | 'Taking…' | 'Taken' | 'Retry taking';

function labelOf(isTaken: boolean, isTaking: boolean, hasFailed: boolean): Label {
  if (isTaking) return 'Taking…';
  if (isTaken) return 'Taken';
  return hasFailed ? 'Retry taking' : 'Take';
}

export function TakeWord({ sessionId, word }: Props) {
  const key = wordKey(sessionId, word);
  const isTaken = useAtomValue(wordTakenAtom(key));
  const [result, take] = useAtom(takeWordAtom(key));
  const isTaking = AsyncResult.isWaiting(result);
  const hasFailed = AsyncResult.isFailure(result) && !isTaking;
  return (
    <Button
      aria-label={`${labelOf(isTaken, isTaking, hasFailed)} “${word.phrase}”`}
      aria-pressed={isTaken}
      className="shrink-0"
      disabled={isTaking || isTaken}
      onClick={() =>
        take({
          sessionId,
          sequence: word.sequence,
          phrase: word.phrase,
          meaning: word.meaning,
        })
      }
      size="sm"
      tone="secondary"
    >
      <Bookmark aria-hidden="true" fill={isTaken ? 'currentColor' : 'none'} />
      {labelOf(isTaken, isTaking, hasFailed)}
    </Button>
  );
}
