import type { PracticeDialogue } from '../src/lib/dialogueTypes';
import type { FinishedPracticeSession } from '../src/lib/finishedPracticeSession';
import type { PracticeSession } from '../src/lib/practiceSessionTypes';
import type { SpeechEngineStatus } from '../src/lib/speechTypes';

export const unavailableSpeechStatus: SpeechEngineStatus = {
  server: 'not_running',
  failure: null,
  is_live_transcript_available: false,
};

export function emptyDialogue(session: PracticeSession): PracticeDialogue {
  return {
    session_id: session.session_id,
    opening_question: session.opening_question,
    turns: [],
    input_sources: [],
    reply_times_ms: [],
    answer_durations_ms: [],
    help_used: [],
    coaching: [],
  };
}

export const initialSession: PracticeSession = {
  session_id: 41,
  opening_question: 'What is one tool that makes your work easier?',
  turn_count: 0,
  target_turns: 8,
  retry_evidence: [],
  topic_id: 'work_technology',
  topic_label: 'Work & technology',
  topic_custom: null,
  duration_goal_seconds: 600,
  active_duration_ms: 0,
  started_at: 1_800_000_000_000,
  is_clock_running: false,
};

export const finishedSession: FinishedPracticeSession = {
  session_id: 41,
  finished: true,
  turn_count: 0,
  target_turns: 8,
  duration_ms: 0,
  topic_label: 'Work & technology',
  duration_goal_seconds: 600,
  numbers: {
    speaking_time: { duration_ms: null, trend: { kind: 'first' } },
    words_per_minute: { value: null, trend: { kind: 'first' } },
    average_answer: { words: null, trend: { kind: 'first' } },
  },
  phrases: [],
  recurring_mistakes: [],
  pending_coaching: 1,
  is_coaching_paused: false,
};
