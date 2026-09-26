export type DailyRecallItem = { phrase_id: number; cue: string };
export type DailyRecallPlan = { items: DailyRecallItem[]; completed_count: number };
export type SpokenRecallResult = {
  phrase_id: number;
  transcript: string;
  target: string;
  wording_observed: boolean;
};

function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isDailyRecallPlan(value: unknown): value is DailyRecallPlan {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'completed_count' in value &&
    typeof value.completed_count === 'number' &&
    Number.isSafeInteger(value.completed_count) &&
    value.completed_count >= 0 &&
    value.completed_count <= 3 &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.length + value.completed_count <= 3 &&
    value.items.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'phrase_id' in item &&
        isPositiveId(item.phrase_id) &&
        'cue' in item &&
        typeof item.cue === 'string' &&
        item.cue.trim().length > 0 &&
        item.cue.length <= 500,
    )
  );
}

export function isSpokenRecallResult(value: unknown): value is SpokenRecallResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'phrase_id' in value &&
    isPositiveId(value.phrase_id) &&
    'transcript' in value &&
    typeof value.transcript === 'string' &&
    value.transcript.trim().length > 0 &&
    value.transcript.length <= 4000 &&
    'target' in value &&
    typeof value.target === 'string' &&
    value.target.trim().length > 0 &&
    value.target.length <= 300 &&
    'wording_observed' in value &&
    typeof value.wording_observed === 'boolean'
  );
}
