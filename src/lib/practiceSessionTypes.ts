import {
  DEFAULT_PRACTICE_MODE,
  defaultPracticePhase,
  isPracticeMode,
  isPracticePhase,
  isTopicId,
  type PracticeMode,
  type PracticePhase,
  type TopicId,
} from './practiceOptions';
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
  /** F12 drill marker; absent only in payloads from older app versions. */
  is_mistake_practice?: boolean;
  /** Optional only for sessions created before F11. */
  practice_mode?: PracticeMode;
  practice_phase?: PracticePhase;
  written_turn_count?: number;
  spoken_turn_count?: number;
};

function isOptionalTurnCount(value: object, key: string): boolean {
  if (!(key in value)) return true;
  const count: unknown = Reflect.get(value, key);
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
}

function hasValidMistakePractice(value: object): boolean {
  if (!('is_mistake_practice' in value) || value.is_mistake_practice !== true) return true;
  const mode: unknown = 'practice_mode' in value ? value.practice_mode : DEFAULT_PRACTICE_MODE;
  const phase: unknown =
    'practice_phase' in value
      ? value.practice_phase
      : isPracticeMode(mode)
        ? defaultPracticePhase(mode)
        : undefined;
  const turns: unknown = Reflect.get(value, 'turn_count');
  const target: unknown = Reflect.get(value, 'target_turns');
  const written: unknown = 'written_turn_count' in value ? value.written_turn_count : 0;
  const spoken: unknown = 'spoken_turn_count' in value ? value.spoken_turn_count : turns;
  return (
    mode === 'voice' &&
    phase === 'speaking' &&
    target === 5 &&
    typeof turns === 'number' &&
    Number.isSafeInteger(turns) &&
    turns <= 5 &&
    written === 0 &&
    spoken === turns
  );
}

function compatiblePracticeStage(mode: PracticeMode, phase: PracticePhase): boolean {
  if (mode === 'voice') return phase === 'speaking';
  if (mode === 'text_chat') return phase === 'writing' || phase === 'writing_review';
  return true;
}

function hasValidStage(value: object): boolean {
  const hasStage =
    'practice_mode' in value ||
    'practice_phase' in value ||
    'written_turn_count' in value ||
    'spoken_turn_count' in value;
  if (!hasStage) return true;
  const rawMode: unknown = 'practice_mode' in value ? value.practice_mode : DEFAULT_PRACTICE_MODE;
  if (!isPracticeMode(rawMode)) return false;
  const rawPhase: unknown =
    'practice_phase' in value ? value.practice_phase : defaultPracticePhase(rawMode);
  if (!isPracticePhase(rawPhase)) return false;
  const mode = rawMode;
  const phase = rawPhase;
  if (!compatiblePracticeStage(mode, phase)) return false;
  const written = 'written_turn_count' in value ? value.written_turn_count : 0;
  const spoken = 'spoken_turn_count' in value ? value.spoken_turn_count : 0;
  const total: unknown = Reflect.get(value, 'turn_count');
  return (
    typeof written === 'number' &&
    typeof spoken === 'number' &&
    typeof total === 'number' &&
    written + spoken <= total
  );
}

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
    typeof value.is_clock_running === 'boolean' &&
    (!('is_mistake_practice' in value) || typeof value.is_mistake_practice === 'boolean') &&
    hasValidMistakePractice(value) &&
    (!('practice_mode' in value) || isPracticeMode(value.practice_mode)) &&
    (!('practice_phase' in value) || isPracticePhase(value.practice_phase)) &&
    isOptionalTurnCount(value, 'written_turn_count') &&
    isOptionalTurnCount(value, 'spoken_turn_count') &&
    hasValidStage(value)
  );
}

export function practiceModeOf(session: PracticeSession): PracticeMode {
  return session.practice_mode ?? DEFAULT_PRACTICE_MODE;
}

export function practicePhaseOf(session: PracticeSession): PracticePhase {
  return session.practice_phase ?? defaultPracticePhase(practiceModeOf(session));
}

export function writtenTurnCountOf(session: PracticeSession): number {
  const mode = practiceModeOf(session);
  if (mode !== 'voice' && practicePhaseOf(session) === 'writing') {
    return session.turn_count;
  }
  if (session.written_turn_count !== undefined) return session.written_turn_count;
  if (mode === 'voice') return 0;
  return session.turn_count;
}

export function spokenTurnCountOf(session: PracticeSession): number {
  const mode = practiceModeOf(session);
  if (session.spoken_turn_count !== undefined) return session.spoken_turn_count;
  return mode === 'text_chat' || mode === 'write_then_speak' ? 0 : session.turn_count;
}
