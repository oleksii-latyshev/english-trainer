import type { LearningMemoryView, MistakeRecord } from '@/core/ipc';
import type { MistakeDetail } from '@/core/ipc/bindings/MistakeDetail';
import type { MistakeGroups } from '@/core/ipc/bindings/MistakeGroups';
import type { MistakeSummary } from '@/core/ipc/bindings/MistakeSummary';
import type { RuleCardView } from '@/core/ipc/bindings/RuleCardView';

export const repeatedMistake: MistakeRecord = {
  id: 17,
  normalized_key: 'grammar:at university',
  category: 'grammar',
  original_example: 'in the university',
  corrected_example: 'at university',
  explanation: 'Use at university when talking about being a student.',
  times_seen: 3,
  times_correct_afterwards: 0,
  last_seen_at: 1_800_000_000_000,
  last_reviewed_at: null,
  next_review_at: 1_900_000_000_000,
  interval_days: 7,
  ease_factor: 2.5,
  status: 'learning',
  is_due: false,
};

export const mistakeMemory: LearningMemoryView = {
  mistakes: [repeatedMistake],
  phrase_cards: [],
  due_count: 0,
};

function summary(id: number, patch: Partial<MistakeSummary> = {}): MistakeSummary {
  return {
    id,
    said: 'I work on it since March.',
    corrected: 'I have been working on it since March.',
    rule_key: 'past_simple_vs_present_perfect',
    lesson_state: 'ready',
    ladder_step: 2,
    is_fixed: false,
    is_due: true,
    last_seen_at: 1_800_000_000_000,
    ...patch,
  };
}

export const perfectMistake = summary(1);
export const agreementMistake = summary(2, {
  said: 'that move',
  corrected: 'that moves',
  rule_key: 'subject_verb_agreement',
  lesson_state: 'pending',
  ladder_step: 1,
});
export const unsortedMistake = summary(3, {
  said: 'He go home.',
  corrected: 'He goes home.',
  rule_key: null,
  lesson_state: 'failed',
});

export const mistakeGroups: MistakeGroups = {
  groups: [
    {
      rule_key: 'past_simple_vs_present_perfect',
      title: 'Past Simple vs Present Perfect',
      summary: 'Finished time takes Past Simple; up to now takes Present Perfect.',
      mistake_count: 7,
      fixed_count: 2,
      due_count: 1,
      relapse_count: 1,
      last_relapse_at: 1_800_000_000_000,
      mistakes: [perfectMistake],
    },
    {
      rule_key: 'subject_verb_agreement',
      title: 'Subject-verb agreement',
      summary: 'A singular subject takes a singular verb.',
      mistake_count: 2,
      fixed_count: 0,
      due_count: 1,
      relapse_count: 0,
      last_relapse_at: null,
      mistakes: [agreementMistake],
    },
  ],
  ungrouped: [unsortedMistake],
  due_count: 3,
};

export const emptyMistakeGroups: MistakeGroups = { groups: [], ungrouped: [], due_count: 0 };

export function mistakeDetail(mistake: MistakeSummary): MistakeDetail {
  return {
    id: mistake.id,
    question: 'How long have you been working on this project?',
    said: mistake.said,
    corrected: mistake.corrected,
    review_explanation: 'Since March needs Present Perfect.',
    session_id: 1,
    sequence: 1,
    last_seen_at: mistake.last_seen_at,
    ladder_step: mistake.ladder_step,
    fixed_at: null,
    next_review_at: 1_800_000_000_000,
    is_due: mistake.is_due,
    rule: mistake.rule_key
      ? { rule_key: mistake.rule_key, title: 'Past Simple vs Present Perfect' }
      : null,
    lesson_state: mistake.lesson_state,
    lesson:
      mistake.lesson_state === 'ready'
        ? {
            explanation: '"Since March" means the work started in the past and is still going on.',
            contrast: [
              { label: 'Finished time', sentence: 'I worked there in 2020.' },
              { label: 'Up to now', sentence: 'I have worked there since 2020.' },
            ],
            examples: ['She has lived in Kyiv for five years.'],
            word: null,
          }
        : null,
  };
}

export const ruleCard: RuleCardView = {
  rule_key: 'past_simple_vs_present_perfect',
  title: 'Past Simple vs Present Perfect',
  summary: 'Finished time takes Past Simple; up to now takes Present Perfect.',
  body: 'Use Past Simple for a finished time and Present Perfect for a period up to now.',
  examples: ['I have lived here since 2019.'],
};
