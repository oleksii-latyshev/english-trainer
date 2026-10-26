import type { PracticeDialogue } from '@/core/ipc/bindings/PracticeDialogue';
import type { PracticeSession } from '@/core/ipc/bindings/PracticeSession';
import { initialSession } from './sessions';

export function savedMistakePractice(answered: number): {
  session: PracticeSession;
  dialogue: PracticeDialogue;
} {
  const session: PracticeSession = {
    ...initialSession,
    opening_question:
      answered === 5
        ? 'Practice complete. Review your answers.'
        : 'What did you learn from your classmates?',
    target_turns: 5,
    turn_count: answered,
    topic_id: 'free_conversation',
    topic_label: 'Usual mistakes',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
    practice_phase: 'speaking',
    written_turn_count: 0,
    spoken_turn_count: answered,
    is_mistake_practice: true,
  };
  const dialogue: PracticeDialogue = {
    session_id: session.session_id,
    opening_question: 'What did you enjoy about your time studying?',
    turns: Array.from({ length: answered }, (_, index) => ({
      learner: `I learned a useful skill at university ${index + 1}.`,
      assistant_reply: 'Thanks for sharing that.',
      assistant_question:
        index === answered - 1
          ? answered === 5
            ? ''
            : session.opening_question
          : `What helped you learn skill ${index + 2}?`,
      answered_by: null,
    })),
    input_sources: Array.from({ length: answered }, () => 'voice'),
    reply_times_ms: Array.from({ length: answered }, () => 250),
    answer_durations_ms: Array.from({ length: answered }, () => null),
    help_used: Array.from({ length: answered }, () => false),
    coaching: Array.from({ length: answered }, () => ({ state: 'pending' })),
  };
  return { session, dialogue };
}

export function longConversation(turns: number): {
  session: PracticeSession;
  dialogue: PracticeDialogue;
} {
  const session: PracticeSession = {
    ...initialSession,
    turn_count: turns,
    target_turns: turns + 4,
    opening_question: `Question ${turns + 1}: what happened next?`,
  };
  const dialogue: PracticeDialogue = {
    session_id: session.session_id,
    opening_question: initialSession.opening_question,
    turns: Array.from({ length: turns }, (_, index) => ({
      learner: `Earlier answer number ${index + 1} about my work.`,
      assistant_reply: `Earlier reply number ${index + 1}.`,
      assistant_question:
        index === turns - 1 ? session.opening_question : `Earlier question ${index + 2}?`,
      answered_by: null,
    })),
    input_sources: Array.from({ length: turns }, () => 'text'),
    reply_times_ms: Array.from({ length: turns }, () => 250),
    answer_durations_ms: Array.from({ length: turns }, () => null),
    help_used: Array.from({ length: turns }, () => false),
    coaching: Array.from({ length: turns }, () => ({ state: 'pending' })),
  };
  return { session, dialogue };
}

export function restoredSpeakingReview(): { session: PracticeSession; dialogue: PracticeDialogue } {
  const session: PracticeSession = {
    ...initialSession,
    turn_count: 2,
    practice_mode: 'write_then_speak',
    practice_phase: 'speaking_review',
    written_turn_count: 1,
    spoken_turn_count: 1,
  };
  const dialogue: PracticeDialogue = {
    session_id: session.session_id,
    opening_question: session.opening_question,
    turns: [
      {
        learner: 'I use a small task board to plan my day.',
        assistant_reply: 'That sounds useful.',
        assistant_question: 'How did you choose it?',
        answered_by: null,
      },
      {
        learner: 'I have used it for a year.',
        assistant_reply: 'That is a helpful routine.',
        assistant_question: 'What changed for you?',
        answered_by: null,
      },
    ],
    input_sources: ['text', 'voice'],
    reply_times_ms: [250, 250],
    answer_durations_ms: [null, 1200],
    help_used: [false, false],
    coaching: [
      {
        state: 'ready',
        feedback: {
          focus_feedback: [
            {
              category: 'grammar',
              original: 'I use',
              improved: 'I have used',
              explanation: 'The present perfect connects this routine to now.',
            },
          ],
          b2_rewrite: 'I have used a small task board to plan my day.',
        },
      },
      { state: 'pending' },
    ],
  };
  return { session, dialogue };
}
