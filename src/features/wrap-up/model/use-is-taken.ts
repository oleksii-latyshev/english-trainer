import { useAtomValue } from '@effect/atom-react';
import { type WordRef, wordKey } from '../helpers/word-key';
import { takenWordsAtom } from './atoms';

export function useIsTaken(sessionId: number): (word: WordRef) => boolean {
  const taken = useAtomValue(takenWordsAtom);
  return (word) => taken[wordKey(sessionId, word)] === true;
}
