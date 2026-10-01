import { invoke, isTauri } from '@tauri-apps/api/core';
import type { LearningItemType } from '@/lib/learningTypes';
import {
  isMemoryRecallResult,
  isMemoryReviewRun,
  type MemoryRecallResult,
  type MemoryReviewRun,
} from '@/lib/memoryRecallTypes';

export async function startMemoryReview(): Promise<MemoryReviewRun | null> {
  if (!isTauri()) throw new Error('Open the desktop app to start a spoken recall review.');
  const result = await invoke<unknown>('start_memory_review');
  if (result === null) return null;
  if (!isMemoryReviewRun(result)) {
    throw new Error('Unexpected memory review response from local database.');
  }
  return result;
}

export async function getMemoryReview(): Promise<MemoryReviewRun | null> {
  if (!isTauri()) throw new Error('Open the desktop app to load a spoken recall review.');
  const result = await invoke<unknown>('get_memory_review');
  if (result === null) return null;
  if (!isMemoryReviewRun(result)) {
    throw new Error('Unexpected memory review response from local database.');
  }
  return result;
}

export async function submitMemoryRecall(
  runId: number,
  itemType: LearningItemType,
  itemId: number,
  transcript: string,
): Promise<MemoryRecallResult> {
  if (!isTauri()) {
    throw new Error('Desktop app required to submit spoken recall.');
  }
  const result = await invoke<unknown>('submit_memory_recall', {
    run_id: runId,
    item_type: itemType,
    item_id: itemId,
    transcript,
  });
  if (!isMemoryRecallResult(result)) {
    throw new Error('Unexpected spoken recall response from local database.');
  }
  if (result.run_id !== runId || result.item_type !== itemType || result.item_id !== itemId) {
    throw new Error('Spoken recall response does not match the submitted queue item.');
  }
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}

export async function finishMemoryReview(runId: number): Promise<boolean> {
  if (!isTauri()) throw new Error('Open the desktop app to finish a spoken recall review.');
  const result = await invoke<unknown>('finish_memory_review', { run_id: runId });
  if (typeof result !== 'boolean') {
    throw new Error('Unexpected finish review response.');
  }
  if (!result)
    throw new Error('This review run could not be finished. Reload Learning Memory and retry.');
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}
