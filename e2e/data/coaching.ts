import type { PracticeSession } from '@/core/ipc/bindings/PracticeSession';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { initialSession } from './sessions';

type Coaching = NonNullable<PracticeDialogue['coaching']>[number];

export const readyWithTip: Coaching = {
  state: 'ready',
  feedback: {
    focus_feedback: [
      {
        category: 'grammar',
        original: 'I work in there',
        improved: 'I work there',
        explanation: 'Drop the extra preposition after work.',
      },
    ],
    b2_rewrite: 'I work there as an engineer.',
  },
};

export const readyWithoutTip: Coaching = {
  state: 'ready',
  feedback: { focus_feedback: [], b2_rewrite: 'It keeps my plans in one place.' },
};

const answers = [
  'I work in there since two years.',
  'It keeps my plans in one place.',
  'I chose it last spring.',
  'I like how simple it is.',
];

export function coachedConversation(coaching: Coaching[]): {
  session: PracticeSession;
  dialogue: PracticeDialogue;
} {
  const session: PracticeSession = {
    ...initialSession,
    turn_count: coaching.length,
    target_turns: coaching.length + 4,
    opening_question: 'What else would you like to share?',
    practice_mode: 'voice',
    practice_phase: 'speaking',
    written_turn_count: 0,
    spoken_turn_count: coaching.length,
  };
  const dialogue: PracticeDialogue = {
    session_id: session.session_id,
    opening_question: initialSession.opening_question,
    turns: coaching.map((_, index) => ({
      learner: answers[index],
      assistant_reply: `Reply number ${index + 1}.`,
      assistant_question: `Question number ${index + 2}?`,
      answered_by: null,
    })),
    input_sources: coaching.map(() => 'text'),
    reply_times_ms: coaching.map(() => 250),
    answer_durations_ms: coaching.map(() => null),
    help_used: coaching.map(() => false),
    coaching,
  };
  return { session, dialogue };
}

export function withCoaching(dialogue: PracticeDialogue, coaching: Coaching[]): PracticeDialogue {
  return { ...dialogue, coaching };
}

export const firstAnswer = answers[0];
export const secondAnswer = answers[1];
