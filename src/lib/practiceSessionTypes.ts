import { isTopicId, type TopicId } from './practiceOptions';
import { type AttemptComparison, isAttemptComparison } from './types';

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= maxLength
  );
}

export type PracticeSession = {
  session_id: number;
  opening_question: string;
  turn_count: number;
  target_turns: number;
  retry_evidence: AttemptComparison[];
  topic_id: TopicId;
  topic_label: string;
  topic_custom: string | null;
  duration_goal_seconds: 300 | 600 | 900;
  active_duration_ms: number;
  started_at: number;
  is_clock_running: boolean;
};

export function isPracticeSession(value: unknown): value is PracticeSession {
  if (typeof value !== 'object' || value === null) return false;
  if (!('session_id' in value) || typeof value.session_id !== 'number') return false;
  if (!('turn_count' in value) || typeof value.turn_count !== 'number') return false;
  return (
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0 &&
    'opening_question' in value &&
    isBoundedText(value.opening_question, 500) &&
    Number.isSafeInteger(value.turn_count) &&
    value.turn_count >= 0 &&
    'target_turns' in value &&
    typeof value.target_turns === 'number' &&
    Number.isSafeInteger(value.target_turns) &&
    value.target_turns > 0 &&
    'retry_evidence' in value &&
    Array.isArray(value.retry_evidence) &&
    value.retry_evidence.every(isAttemptComparison) &&
    'topic_id' in value &&
    isTopicId(value.topic_id) &&
    'topic_label' in value &&
    isBoundedText(value.topic_label, 150) &&
    'topic_custom' in value &&
    (value.topic_custom === null ||
      (typeof value.topic_custom === 'string' && Array.from(value.topic_custom).length <= 150)) &&
    'duration_goal_seconds' in value &&
    (value.duration_goal_seconds === 300 ||
      value.duration_goal_seconds === 600 ||
      value.duration_goal_seconds === 900) &&
    'active_duration_ms' in value &&
    typeof value.active_duration_ms === 'number' &&
    Number.isSafeInteger(value.active_duration_ms) &&
    value.active_duration_ms >= 0 &&
    'started_at' in value &&
    typeof value.started_at === 'number' &&
    Number.isSafeInteger(value.started_at) &&
    value.started_at >= 0 &&
    'is_clock_running' in value &&
    typeof value.is_clock_running === 'boolean'
  );
}
