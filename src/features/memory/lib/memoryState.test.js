import { describe, expect, it } from 'bun:test';
import {
  applyReviewResult,
  filterMemoryItems,
  formatDueText,
  formatStatusLabel,
} from './memoryState';

describe('memoryState pure functions', () => {
  const sampleMistake = {
    id: 1,
    normalized_key: 'grammar:i work there',
    category: 'grammar',
    original_example: 'I work in there',
    corrected_example: 'I work there',
    explanation: 'Drop extra preposition',
    times_seen: 2,
    times_correct_afterwards: 0,
    last_seen_at: 1000,
    last_reviewed_at: null,
    next_review_at: 500,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'new',
    is_due: true,
  };

  const samplePhrase = {
    id: 1,
    phrase: 'The main trade-off was',
    normalized_phrase: 'the main trade off was',
    meaning_or_note: 'Discussing technical decisions',
    session_id: null,
    sequence: null,
    created_at: 1000,
    last_reviewed_at: null,
    next_review_at: 2000,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'learning',
    is_due: false,
  };

  const sampleView = {
    mistakes: [sampleMistake],
    phrase_cards: [samplePhrase],
    due_count: 1,
  };

  it('formats due text correctly based on timestamps', () => {
    expect(formatDueText(500, 1000)).toBe('Due for review');
    expect(formatDueText(1000 + 3600 * 1000 * 2, 1000)).toBe('Due in 2h');
    expect(formatDueText(1000 + 3600 * 1000 * 48, 1000)).toBe('Due in 2d');
  });

  it('formats status labels cleanly', () => {
    expect(formatStatusLabel('new')).toBe('New');
    expect(formatStatusLabel('learning')).toBe('Learning');
    expect(formatStatusLabel('improving')).toBe('Improving');
    expect(formatStatusLabel('stable')).toBe('Stable');
  });

  it('filters items by category tab', () => {
    const all = filterMemoryItems(sampleView, 'all');
    expect(all.mistakes.length).toBe(1);
    expect(all.phraseCards.length).toBe(1);

    const due = filterMemoryItems(sampleView, 'due');
    expect(due.mistakes.length).toBe(1);
    expect(due.phraseCards.length).toBe(0);

    const mistakes = filterMemoryItems(sampleView, 'mistakes');
    expect(mistakes.mistakes.length).toBe(1);
    expect(mistakes.phraseCards.length).toBe(0);

    const phrases = filterMemoryItems(sampleView, 'phrases');
    expect(phrases.mistakes.length).toBe(0);
    expect(phrases.phraseCards.length).toBe(1);
  });

  it('applies review result immutably', () => {
    const result = {
      item_type: 'mistake',
      item_id: 1,
      status: 'learning',
      next_review_at: 5000,
      interval_days: 2,
      response: 'remembered',
    };
    const updated = applyReviewResult(sampleView, result, 1000);
    expect(updated.mistakes[0].status).toBe('learning');
    expect(updated.mistakes[0].interval_days).toBe(2);
    expect(updated.mistakes[0].is_due).toBe(false);
    expect(updated.due_count).toBe(0);

    // Original view remains unchanged
    expect(sampleView.mistakes[0].status).toBe('new');
    expect(sampleView.due_count).toBe(1);
  });
});
