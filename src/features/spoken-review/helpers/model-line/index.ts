import type { RecallResult } from '@/core/learning-memory';

export type ModelLine = { readonly label: string; readonly text: string };

export function modelLineOf(result: RecallResult, modelAnswer: string | null): ModelLine {
  const isMistake = result.item_type === 'mistake';
  if (modelAnswer) {
    return { label: isMistake ? 'Said better' : 'With the phrase', text: modelAnswer };
  }
  return { label: isMistake ? 'Saved correction' : 'Saved phrase', text: result.target };
}
