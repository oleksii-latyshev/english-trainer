import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  isLearningMemoryView,
  isPhraseCardRecord,
  type LearningMemoryView,
  type PhraseCardRecord,
} from '@/lib/learningTypes';
import { isTurnUsageAssessment, type TurnUsageAssessment } from '@/lib/usageTypes';
import { notifyLearningMemoryChanged } from './memoryChanged';

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

export async function reviewPracticeMemoryUsage(
  sessionId: number,
  sequence: number,
): Promise<TurnUsageAssessment> {
  if (!isTauri()) {
    throw new Error('Desktop app required for usage review.');
  }
  const result = await invoke<unknown>('review_practice_memory_usage', {
    session_id: sessionId,
    sequence,
  });
  if (!isTurnUsageAssessment(result, { sessionId, sequence })) {
    throw new Error('Unexpected turn usage assessment response.');
  }
  notifyLearningMemoryChanged();
  return result;
}

export async function getPracticeMemoryUsage(
  sessionId: number,
  sequence: number,
): Promise<TurnUsageAssessment | null> {
  if (!isTauri()) {
    return null;
  }
  const result = await invoke<unknown>('get_practice_memory_usage', {
    session_id: sessionId,
    sequence,
  });
  if (result === null) {
    return null;
  }
  if (!isTurnUsageAssessment(result, { sessionId, sequence })) {
    throw new Error('Unexpected turn usage assessment response.');
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
  notifyLearningMemoryChanged();
  return result;
}

/** Removes a saved phrase card (the toast's Undo). False when it was already gone. */
export async function deletePhraseCard(phraseId: number): Promise<boolean> {
  if (!isTauri()) {
    throw new Error('Desktop app required to remove phrases.');
  }
  const result = await invoke<unknown>('delete_phrase_card', { phrase_id: phraseId });
  if (typeof result !== 'boolean') {
    throw new Error('Unexpected phrase removal response.');
  }
  notifyLearningMemoryChanged();
  return result;
}
