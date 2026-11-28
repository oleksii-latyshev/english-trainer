import { useAtomValue } from '@effect/atom-react';
import { type WordRef, wordKey } from '../helpers/word-key';
import { isWordTaken, savedKeysAtom, takenWordsAtom } from './atoms';

export function useIsTaken(sessionId: number): (word: WordRef) => boolean {
  const taken = useAtomValue(takenWordsAtom);
  const saved = useAtomValue(savedKeysAtom);
  return (word) => isWordTaken(taken, saved, wordKey(sessionId, word));
}
