import { expect, it } from 'bun:test';
import { DEFAULT_SELECTION } from '../../constants';
import { canStart, toPracticeOptions } from './index';

it('starts the chosen topic with the chosen mode and length', () => {
  const selection = { ...DEFAULT_SELECTION, mode: 'text_chat', duration: 900 } as const;
  expect(toPracticeOptions(selection)).toEqual({
    topic_id: 'work_technology',
    topic_custom: null,
    duration_goal_seconds: 900,
    practice_mode: 'text_chat',
  });
});

it('sends the interview focus instead of the generic interview topic', () => {
  const selection = {
    ...DEFAULT_SELECTION,
    topic: 'job_interview',
    interviewFocus: 'job_interview_technical',
  } as const;
  expect(toPracticeOptions(selection).topic_id).toBe('job_interview_technical');
});

it('sends the trimmed own topic only for the free topic', () => {
  const free = { ...DEFAULT_SELECTION, topic: 'free_topic', customTopic: '  a book  ' } as const;
  expect(toPracticeOptions(free)).toMatchObject({ topic_id: 'free_topic', topic_custom: 'a book' });
  const other = { ...DEFAULT_SELECTION, customTopic: 'left over' };
  expect(toPracticeOptions(other).topic_custom).toBeNull();
});

it('lets Eva pick the topic without sending a custom one', () => {
  const free = { ...DEFAULT_SELECTION, topic: 'free_topic', customTopic: 'a book' } as const;
  expect(toPracticeOptions(free, 'random')).toMatchObject({
    topic_id: 'random',
    topic_custom: null,
  });
});

it('needs a non-empty own topic of at most 150 characters for the free topic', () => {
  const free = { ...DEFAULT_SELECTION, topic: 'free_topic' } as const;
  expect(canStart({ ...free, customTopic: '   ' })).toBe(false);
  expect(canStart({ ...free, customTopic: 'a'.repeat(150) })).toBe(true);
  expect(canStart({ ...free, customTopic: 'a'.repeat(151) })).toBe(false);
  expect(canStart(DEFAULT_SELECTION)).toBe(true);
});
