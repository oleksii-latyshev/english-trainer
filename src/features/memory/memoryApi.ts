import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  isLearningMemoryView,
  isPhraseCardRecord,
  isReviewResult,
  type LearningItemType,
  type LearningMemoryView,
  type PhraseCardRecord,
  type ReviewResponse,
  type ReviewResult,
} from '@/lib/learningTypes';

export async function getLearningMemory(): Promise<LearningMemoryView> {
  if (!isTauri()) {
    return { mistakes: [], phrase_cards: [], due_count: 0 };
  }
  const result = await invoke<unknown>('get_learning_memory');
  if (!isLearningMemoryView(result)) {
    throw new Error('Unexpected learning memory response from local database.');
  }
  return result;
}

export async function savePhraseCard(
  phrase: string,
  meaningOrNote?: string,
  sessionId?: number,
  sequence?: number,
): Promise<PhraseCardRecord> {
  if (!isTauri()) {
    throw new Error('Desktop app required to save phrases.');
  }
  const result = await invoke<unknown>('save_phrase_card', {
    phrase,
    meaning_or_note: meaningOrNote,
    session_id: sessionId,
    sequence,
  });
  if (!isPhraseCardRecord(result)) {
    throw new Error('Unexpected phrase card response.');
  }
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}

export async function submitLearningReview(
  itemType: LearningItemType,
  itemId: number,
  response: ReviewResponse,
): Promise<ReviewResult> {
  if (!isTauri()) {
    throw new Error('Desktop app required to submit reviews.');
  }
  const result = await invoke<unknown>('submit_learning_review', {
    item_type: itemType,
    item_id: itemId,
    response,
  });
  if (!isReviewResult(result)) {
    throw new Error('Unexpected review response.');
  }
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}
