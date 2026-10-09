export const TOPICS = [
  {
    id: 'work_technology',
    label: 'Work & technology',
    description: 'Projects, tools, and how things work.',
  },
  { id: 'daily_life', label: 'Daily life', description: 'Routines, places, and everyday choices.' },
  {
    id: 'opinions_debates',
    label: 'Opinions & debates',
    description: 'Share a view and explain your reasons.',
  },
  {
    id: 'plans_stories',
    label: 'Plans & stories',
    description: 'Talk about what happened and what comes next.',
  },
  {
    id: 'job_interview_hr',
    label: 'Job interview · HR',
    description: 'Motivation, strengths, and career goals.',
  },
  {
    id: 'job_interview_behavioural',
    label: 'Job interview · behavioural',
    description: 'Examples of how you handled a situation.',
  },
  {
    id: 'job_interview_technical',
    label: 'Job interview · technical',
    description: 'Explain technical choices and trade-offs.',
  },
  { id: 'free_topic', label: 'Free topic', description: 'Choose a subject to talk about.' },
  { id: 'random', label: 'Random topic', description: 'Let Eva pick a topic for you.' },
] as const;

export type TopicId = (typeof TOPICS)[number]['id'] | 'free_conversation';
const TOPIC_IDS: readonly TopicId[] = [
  'work_technology',
  'daily_life',
  'opinions_debates',
  'plans_stories',
  'job_interview_hr',
  'job_interview_behavioural',
  'job_interview_technical',
  'free_topic',
  'free_conversation',
  'random',
];

export function isTopicId(value: unknown): value is TopicId {
  return TOPIC_IDS.some((topicId) => topicId === value);
}

export type DurationGoalSeconds = 300 | 600 | 900;
export type PracticeOptions = {
  topic_id: TopicId;
  topic_custom: string | null;
  duration_goal_seconds: DurationGoalSeconds;
};

export const DEFAULT_PRACTICE_OPTIONS: PracticeOptions = {
  topic_id: 'work_technology',
  topic_custom: null,
  duration_goal_seconds: 600,
};

export function topicLabel(topicId: string, customTopic: string | null = null): string {
  if (topicId === 'free_topic' && customTopic?.trim()) return customTopic.trim();
  if (topicId === 'free_conversation') return 'Free conversation';
  return (
    TOPICS.find((topic) => topic.id === topicId && topic.id !== 'random')?.label ?? 'Random topic'
  );
}

export function formatElapsedClock(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function elapsedSessionMs(
  activeDurationMs: number,
  snapshotAt: number,
  isClockRunning: boolean,
  now: number,
): number {
  return activeDurationMs + (isClockRunning ? Math.max(0, now - snapshotAt) : 0);
}

export function remainingMinutes(durationGoalSeconds: number, activeDurationMs: number): number {
  return Math.max(0, Math.ceil((durationGoalSeconds * 1000 - activeDurationMs) / 60_000));
}

export function formatSessionWhen(startedAt: number, now: number): string {
  const date = new Date(startedAt);
  const today = new Date(now);
  const dayDiff = Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000,
  );
  const when =
    dayDiff === 0
      ? 'today'
      : dayDiff === 1
        ? 'yesterday'
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Started ${when}`;
}
