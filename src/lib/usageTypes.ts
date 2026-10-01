import {
  isLearningItemType,
  isLearningStatus,
  type LearningItemType,
  type LearningStatus,
} from './learningTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && [...value].length <= maxLength;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export type UsageOutcome = 'correct' | 'incorrect' | 'uncertain';

export function isUsageOutcome(value: unknown): value is UsageOutcome {
  return value === 'correct' || value === 'incorrect' || value === 'uncertain';
}

export type UsageAssessmentFinding = {
  item_type: LearningItemType;
  item_id: number;
  target: string;
  outcome: UsageOutcome;
  confidence: number;
  exact_excerpt: string;
  credited: boolean;
  status_after: LearningStatus;
};

export function isUsageAssessmentFinding(value: unknown): value is UsageAssessmentFinding {
  if (!isRecord(value)) return false;
  const creditedEvidence =
    value.credited === true &&
    value.outcome !== 'uncertain' &&
    isConfidence(value.confidence) &&
    value.confidence >= 0.9 &&
    isBoundedText(value.exact_excerpt, 500);

  return (
    isLearningItemType(value.item_type) &&
    isPositiveInteger(value.item_id) &&
    isBoundedText(value.target, 300) &&
    isUsageOutcome(value.outcome) &&
    isConfidence(value.confidence) &&
    typeof value.exact_excerpt === 'string' &&
    [...value.exact_excerpt].length <= 500 &&
    typeof value.credited === 'boolean' &&
    (!value.credited || creditedEvidence) &&
    isLearningStatus(value.status_after)
  );
}

export type TurnUsageAssessment = {
  session_id: number;
  sequence: number;
  assessed_at: number;
  findings: UsageAssessmentFinding[];
};

export function isTurnUsageAssessment(
  value: unknown,
  expected?: { sessionId: number; sequence: number },
): value is TurnUsageAssessment {
  if (!isRecord(value)) return false;
  if (
    expected &&
    (value.session_id !== expected.sessionId || value.sequence !== expected.sequence)
  ) {
    return false;
  }
  if (!Array.isArray(value.findings) || value.findings.length > 3) return false;
  if (!value.findings.every(isUsageAssessmentFinding)) return false;
  const identities = value.findings.map((finding) => {
    if (!isRecord(finding)) return '';
    return `${String(finding.item_type)}:${String(finding.item_id)}`;
  });

  return (
    isPositiveInteger(value.session_id) &&
    isPositiveInteger(value.sequence) &&
    value.sequence <= 2 &&
    isNonNegativeInteger(value.assessed_at) &&
    new Set(identities).size === identities.length
  );
}

export type UsageEventRecord = {
  id: number;
  item_type: LearningItemType;
  item_id: number;
  session_id: number;
  sequence: number;
  origin: 'assessment' | 'feedback';
  original_turn_time: number;
  outcome: 'correct' | 'incorrect';
  exact_excerpt: string;
  confidence: number;
  created_at: number;
};

export function isUsageEventRecord(value: unknown): value is UsageEventRecord {
  if (!isRecord(value)) return false;
  const isAssessmentOrigin = value.origin === 'assessment';
  const hasValidOriginOutcome = isAssessmentOrigin
    ? value.outcome === 'correct' || value.outcome === 'incorrect'
    : value.origin === 'feedback' && value.item_type === 'mistake' && value.outcome === 'incorrect';

  return (
    isPositiveInteger(value.id) &&
    isLearningItemType(value.item_type) &&
    isPositiveInteger(value.item_id) &&
    isPositiveInteger(value.session_id) &&
    isPositiveInteger(value.sequence) &&
    hasValidOriginOutcome &&
    (value.origin === 'feedback' || value.sequence <= 2) &&
    isNonNegativeInteger(value.original_turn_time) &&
    isBoundedText(value.exact_excerpt, 500) &&
    isConfidence(value.confidence) &&
    value.confidence >= 0.9 &&
    isNonNegativeInteger(value.created_at)
  );
}

export type MemoryUsageEvidence = {
  item_type: LearningItemType;
  item_id: number;
  distinct_session_count: number;
  streak: number;
  events: UsageEventRecord[];
};

export function isMemoryUsageEvidence(
  value: unknown,
  expected?: { itemType: LearningItemType; itemId: number },
): value is MemoryUsageEvidence {
  if (!isRecord(value)) return false;
  if (expected && (value.item_type !== expected.itemType || value.item_id !== expected.itemId)) {
    return false;
  }
  if (!Array.isArray(value.events) || value.events.length > 5) return false;
  if (!value.events.every(isUsageEventRecord)) return false;
  const eventIds = value.events.map((event) => {
    if (!isRecord(event)) return '';
    return String(event.id);
  });

  return (
    isLearningItemType(value.item_type) &&
    isPositiveInteger(value.item_id) &&
    isNonNegativeInteger(value.distinct_session_count) &&
    isNonNegativeInteger(value.streak) &&
    value.events.every(
      (event) =>
        isRecord(event) && event.item_type === value.item_type && event.item_id === value.item_id,
    ) &&
    new Set(eventIds).size === eventIds.length
  );
}
