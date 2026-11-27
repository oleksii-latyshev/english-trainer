export type WordRef = {
  readonly sequence: number;
  readonly phrase: string;
};

export function wordKey(sessionId: number, word: WordRef): string {
  return `${sessionId}:${word.sequence}:${word.phrase.trim().toLowerCase()}`;
}
