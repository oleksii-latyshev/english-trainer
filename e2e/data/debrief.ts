import type { PracticeDialogue } from '@/core/ipc/bindings/PracticeDialogue';
import { coachedConversation } from './coaching';

type Coaching = NonNullable<PracticeDialogue['coaching']>[number];
type DebriefWord = PracticeDialogue['debrief_words'][number];

export const forTwoYears: DebriefWord = {
  sequence: 1,
  phrase: 'for two years',
  meaning: 'during the last two years',
  example: 'I have worked there for two years.',
};

export const getPaid: DebriefWord = {
  sequence: 1,
  phrase: 'get paid',
  meaning: 'receive money for work',
  example: 'I get paid at the end of the month.',
};

export const organised: DebriefWord = {
  sequence: 2,
  phrase: 'organised',
  meaning: 'arranged in a clear order',
  example: 'It keeps my plans organised.',
};

const inOneGo: DebriefWord = {
  sequence: 2,
  phrase: 'in one go',
  meaning: 'all at once',
  example: 'I finish the report in one go.',
};

const shortlisted: DebriefWord = {
  sequence: 3,
  phrase: 'shortlisted',
  meaning: 'put on a short list of final choices',
  example: 'I shortlisted three tools and chose one.',
};

const fiveWords = [forTwoYears, getPaid, organised, inOneGo, shortlisted];

const fixAndWords: Coaching = {
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
    b2_rewrite: 'I have worked there for two years.',
    upgrades: [],
    gaps: [],
    words_to_take: [
      { phrase: forTwoYears.phrase, meaning: forTwoYears.meaning, example: forTwoYears.example },
      { phrase: getPaid.phrase, meaning: getPaid.meaning, example: getPaid.example },
    ],
  },
};

const betterAndWords: Coaching = {
  state: 'ready',
  feedback: {
    focus_feedback: [],
    b2_rewrite: 'It keeps my plans organised.',
    upgrades: [
      {
        original: 'in one place',
        improved: 'organised',
        explanation: 'Organised is the natural word for plans that are tidy.',
      },
    ],
    gaps: [],
    words_to_take: [
      { phrase: organised.phrase, meaning: organised.meaning, example: organised.example },
      { phrase: inOneGo.phrase, meaning: inOneGo.meaning, example: inOneGo.example },
    ],
  },
};

const gapAndWord: Coaching = {
  state: 'ready',
  feedback: {
    focus_feedback: [],
    b2_rewrite: 'I shortlisted a few tools and chose it last spring.',
    upgrades: [],
    gaps: [
      {
        original: 'I chose it',
        word: 'shortlisted',
        meaning: 'put on a short list of final choices',
      },
    ],
    words_to_take: [
      { phrase: shortlisted.phrase, meaning: shortlisted.meaning, example: shortlisted.example },
    ],
  },
};

export function debriefConversation(
  words: DebriefWord[] = fiveWords,
  wins: PracticeDialogue['debrief_wins'] = [],
  habits: PracticeDialogue['habits'] = [],
) {
  return coachedConversation([fixAndWords, betterAndWords, gapAndWord], words, wins, habits);
}
