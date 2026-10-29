import type { RuleKey } from '@/core/ipc/bindings/RuleKey';

export type RunItemSeed = {
  mistake_id: number;
  step: 1 | 2 | 3 | 4;
  rule_key: RuleKey;
  question: string;
  said: string;
  corrected: string;
  lesson: string;
  accepted: string[];
  gaps: { start: number; end: number }[];
};

export const pullRequestItem: RunItemSeed = {
  mistake_id: 2,
  step: 1,
  rule_key: 'subject_verb_agreement',
  question: 'What does this pull request change?',
  said: 'It is a pull request that move the settings into one screen.',
  corrected: 'It is a pull request that moves the settings into one screen.',
  lesson: '"That" stands for a pull request, one thing, so the verb takes -s.',
  accepted: [],
  gaps: [{ start: 6, end: 7 }],
};

export const fixItItem: RunItemSeed = {
  mistake_id: 3,
  step: 2,
  rule_key: 'subject_verb_agreement',
  question: 'Where does he go after work?',
  said: 'He go home.',
  corrected: 'He goes home.',
  lesson: 'He, she and it take -s in the present.',
  accepted: ['He goes back home.'],
  gaps: [],
};

export const sayItItem: RunItemSeed = {
  mistake_id: 1,
  step: 3,
  rule_key: 'past_simple_vs_present_perfect',
  question: 'How long have you been working on this project?',
  said: 'I work on it since March.',
  corrected: 'I have been working on it since March.',
  lesson: 'Since March means it started in the past and is still going on.',
  accepted: [],
  gaps: [],
};

export const useItItem: RunItemSeed = {
  mistake_id: 4,
  step: 4,
  rule_key: 'past_simple_vs_present_perfect',
  question: 'What have you finished this week?',
  said: 'I finish the report yesterday.',
  corrected: 'I finished the report yesterday.',
  lesson: 'A finished time such as yesterday takes the Past Simple.',
  accepted: [],
  gaps: [],
};

export const fourStepRun: RunItemSeed[] = [pullRequestItem, fixItItem, sayItItem, useItItem];

export const SPOKEN_CORRECT = 'I have been working on it since March.';
export const SPOKEN_WRONG = 'I work on it since March.';
