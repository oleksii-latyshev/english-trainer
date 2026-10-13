import { MAX_CUSTOM_TOPIC_CHARS } from '../../constants';
import type { PracticeOptions, PracticeSelection } from '../../types';

function trimmedTopic(selection: PracticeSelection): string {
  return selection.customTopic.trim();
}

export function canStart(selection: PracticeSelection): boolean {
  if (selection.topic !== 'free_topic') return true;
  const topic = trimmedTopic(selection);
  return topic.length > 0 && Array.from(topic).length <= MAX_CUSTOM_TOPIC_CHARS;
}

export function toPracticeOptions(
  selection: PracticeSelection,
  pick: 'chosen' | 'random' = 'chosen',
): PracticeOptions {
  const topicId = selection.topic === 'job_interview' ? selection.interviewFocus : selection.topic;
  const isCustom = pick === 'chosen' && topicId === 'free_topic';
  return {
    topic_id: pick === 'random' ? 'random' : topicId,
    topic_custom: isCustom ? trimmedTopic(selection) : null,
    duration_goal_seconds: selection.duration,
    practice_mode: selection.mode,
  };
}
