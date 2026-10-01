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
