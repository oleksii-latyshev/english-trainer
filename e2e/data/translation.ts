import type { PracticeDialogue } from '@/core/ipc/bindings/PracticeDialogue';
import type { PracticeSession } from '@/core/ipc/bindings/PracticeSession';
import { initialSession } from './sessions';

export const wordSession: PracticeSession = {
  ...initialSession,
  practice_mode: 'text_chat',
  practice_phase: 'writing',
  turn_count: 1,
  written_turn_count: 1,
  spoken_turn_count: 0,
  opening_question: 'Which useful tool helps you plan your projects?',
};
export const wordDialogue: PracticeDialogue = {
  session_id: wordSession.session_id,
  opening_question: initialSession.opening_question,
  turns: [
    {
      learner: 'I use a useful tool for my projects.',
      assistant_reply: 'That sounds practical.',
      assistant_question: wordSession.opening_question,
      answered_by: null,
    },
  ],
  input_sources: ['text'],
  reply_times_ms: [250],
  answer_durations_ms: [null],
  help_used: [false],
  coaching: [
    {
      state: 'ready',
      feedback: {
        focus_feedback: [
          {
            category: 'grammar',
            original: 'I use',
            improved: 'I have used',
            explanation: 'The present perfect connects your experience to now.',
          },
        ],
        b2_rewrite: 'I have used a useful tool for my projects.',
      },
    },
  ],
};
