import { matchesTranslationWord } from './translationTypes';

export function isCurrentTranslationResult({
  requestId,
  currentId,
  isPanelOpen,
  requestPath,
  currentPath,
  resultWord,
  requestedWord,
}: {
  requestId: number;
  currentId: number;
  isPanelOpen: boolean;
  requestPath: string;
  currentPath: string;
  resultWord: string;
  requestedWord: string;
}): boolean {
  return (
    requestId === currentId &&
    isPanelOpen &&
    requestPath === currentPath &&
    matchesTranslationWord(resultWord, requestedWord)
  );
}
