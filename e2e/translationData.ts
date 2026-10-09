import type { PracticeDialogue } from '../src/lib/dialogueTypes';
import type { PracticeSession } from '../src/lib/practiceSessionTypes';
import { initialSession } from './fixtureData';

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
    },
  ],
  input_sources: ['text'],
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
