import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  isLearningMemoryView,
  isPhraseCardRecord,
  type LearningItemType,
  type LearningMemoryView,
  type PhraseCardRecord,
} from '@/lib/learningTypes';
import {
  isMemoryUsageEvidence,
  isTurnUsageAssessment,
  type MemoryUsageEvidence,
  type TurnUsageAssessment,
} from '@/lib/usageTypes';

export async function getLearningMemory(markExposure = false): Promise<LearningMemoryView> {
  if (!isTauri()) {
    return { mistakes: [], phrase_cards: [], due_count: 0 };
  }
  const command = markExposure ? 'view_learning_memory' : 'get_learning_memory';
  const result = await invoke<unknown>(command);
  if (!isLearningMemoryView(result)) {
    throw new Error('Unexpected learning memory response from local database.');
  }
  return result;
}

export async function getMemoryUsageEvidence(
  itemType: LearningItemType,
  itemId: number,
): Promise<MemoryUsageEvidence> {
  if (!isTauri()) {
    return {
      item_type: itemType,
      item_id: itemId,
      distinct_session_count: 0,
      streak: 0,
      events: [],
    };
  }
  const result = await invoke<unknown>('get_memory_usage_evidence', {
    item_type: itemType,
    item_id: itemId,
  });
  if (!isMemoryUsageEvidence(result, { itemType, itemId })) {
    throw new Error('Unexpected memory usage evidence response.');
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
  window.dispatchEvent(new Event('learning-memory-changed'));
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
  window.dispatchEvent(new Event('learning-memory-changed'));
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
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}

/** Removes a mistake and the evidence kept about it. False when it was already gone. */
export async function deleteMistake(mistakeId: number): Promise<boolean> {
  if (!isTauri()) {
    throw new Error('Desktop app required to remove mistakes.');
  }
  const result = await invoke<unknown>('delete_mistake', { mistake_id: mistakeId });
  if (typeof result !== 'boolean') {
    throw new Error('Unexpected mistake removal response.');
  }
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}

/** Hides a phrase or mistake from Memory and review. False when it was already archived or gone. */
export async function archiveLearningItem(
  itemType: LearningItemType,
  itemId: number,
): Promise<boolean> {
  if (!isTauri()) {
    throw new Error('Desktop app required to archive items.');
  }
  const result = await invoke<unknown>('archive_learning_item', {
    item_type: itemType,
    item_id: itemId,
  });
  if (typeof result !== 'boolean') {
    throw new Error('Unexpected archive response.');
  }
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}
