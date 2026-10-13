import type { MemoryTab } from '../../types';

export const COLUMN_TITLE: Readonly<Record<MemoryTab, string>> = {
  phrases: 'Phrase and where it came from',
  mistakes: 'Original → better',
};

const EMPTY_COPY: Readonly<Record<MemoryTab, { title: string; hint: string }>> = {
  phrases: {
    title: 'No phrases saved yet',
    hint: 'Save one under an answer in a conversation, and it will wait here for review.',
  },
  mistakes: {
    title: 'No mistakes yet',
    hint: 'When Eva’s notes point one out, it is added here for you.',
  },
};

export function isMemoryTab(value: string): value is MemoryTab {
  return value === 'phrases' || value === 'mistakes';
}

export function emptyCopy(tab: MemoryTab, query: string): { title: string; hint: string } {
  const trimmed = query.trim();
  if (trimmed) {
    return {
      title: `Nothing matches “${trimmed}”`,
      hint: 'Try another word, or look in the other tab.',
    };
  }
  return EMPTY_COPY[tab];
}
