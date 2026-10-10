import { invoke, isTauri } from '@tauri-apps/api/core';
import type { LearningItemType } from '@/lib/learningTypes';
import {
  isMemoryRecallResult,
  isMemoryReviewRun,
  type MemoryRecallResult,
  type MemoryReviewRun,
} from '@/lib/memoryRecallTypes';
import { isReviewMaterials, type ReviewMaterials } from '@/lib/reviewMaterialTypes';

export async function startMemoryReview(options?: {
  warmup?: boolean;
}): Promise<MemoryReviewRun | null> {
  const result = await invoke<unknown>(
    'start_memory_review',
    options?.warmup ? { warmup: true } : {},
  );
  if (result === null) return null;
  if (!isMemoryReviewRun(result)) {
    throw new Error('Unexpected memory review response from local database.');
  }
  return result;
}

async function readReviewMaterials(
  command: string,
  args: Record<string, unknown>,
): Promise<ReviewMaterials> {
  const result = await invoke<unknown>(command, args);
  if (!isReviewMaterials(result)) throw new Error('Unexpected spoken review materials response.');
  if (result.run_id !== args.run_id) throw new Error('Review materials belong to another run.');
  return result;
}

export function getReviewMaterial(runId: number): Promise<ReviewMaterials> {
  return readReviewMaterials('get_review_material', { run_id: runId });
}

export function prepareReviewMaterial(runId: number, retry = false): Promise<ReviewMaterials> {
  return readReviewMaterials('prepare_review_material', { run_id: runId, retry });
}

export function revealReviewPhrase(runId: number, position: number): Promise<ReviewMaterials> {
  return readReviewMaterials('reveal_review_phrase', { run_id: runId, position });
}

export async function getMemoryReview(): Promise<MemoryReviewRun | null> {
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

/** Passes on the next unanswered item; it stays due. Returns the run as it stands. */
export async function skipMemoryReviewItem(
  runId: number,
  itemType: LearningItemType,
  itemId: number,
): Promise<MemoryReviewRun> {
  const result = await invoke<unknown>('skip_memory_review_item', {
    run_id: runId,
    item_type: itemType,
    item_id: itemId,
  });
  if (!isMemoryReviewRun(result) || result.run_id !== runId) {
    throw new Error('Unexpected skip response from local database.');
  }
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}

export async function finishMemoryReview(runId: number): Promise<boolean> {
  const result = await invoke<unknown>('finish_memory_review', { run_id: runId });
  if (typeof result !== 'boolean') {
    throw new Error('Unexpected finish review response.');
  }
  if (!result)
    throw new Error('This review run could not be finished. Reload Learning Memory and retry.');
  window.dispatchEvent(new Event('learning-memory-changed'));
  return result;
}
