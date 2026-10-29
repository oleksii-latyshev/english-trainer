export const COLUMN_TITLE = 'Phrase and where it came from';

const EMPTY_COPY = {
  title: 'No phrases saved yet',
  hint: 'Save one under an answer in a conversation, and it will wait here for review.',
} as const;

export function emptyCopy(query: string): { title: string; hint: string } {
  const trimmed = query.trim();
  if (trimmed) {
    return {
      title: `Nothing matches “${trimmed}”`,
      hint: 'Try another word.',
    };
  }
  return EMPTY_COPY;
}
