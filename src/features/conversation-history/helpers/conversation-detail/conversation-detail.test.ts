import { describe, expect, it } from 'bun:test';
import type { ConversationItem } from '../../types';
import { conversationDetail } from './index';

const NOW = new Date(2026, 10, 28, 15, 0).getTime();

function anItem(overrides: Partial<ConversationItem> = {}): ConversationItem {
  return {
    session_id: 7,
    ended_at: new Date(2026, 10, 28, 9, 0).getTime(),
    title: 'Work & technology',
    answer_count: 6,
    focus_rule_title: null,
    ...overrides,
  };
}

describe('conversationDetail', () => {
  it('names the day, the answers and the rule', () => {
    expect(conversationDetail(anItem({ focus_rule_title: 'Present perfect' }), NOW)).toBe(
      'Today · 6 answers · Present perfect',
    );
  });

  it('says yesterday and a single answer', () => {
    const yesterday = new Date(2026, 10, 27, 20, 0).getTime();
    expect(conversationDetail(anItem({ ended_at: yesterday, answer_count: 1 }), NOW)).toBe(
      'Yesterday · 1 answer',
    );
  });

  it('gives an older day as a short date', () => {
    const older = new Date(2026, 10, 3, 20, 0).getTime();
    const label = conversationDetail(anItem({ ended_at: older }), NOW);
    expect(label.endsWith(' · 6 answers')).toBe(true);
    expect(label).not.toContain('Today');
  });
});
