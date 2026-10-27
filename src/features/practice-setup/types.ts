export type PracticeMode = 'voice' | 'text_chat' | 'write_then_speak';

export type DurationGoalSeconds = 300 | 600 | 900 | null;

export type TopicChoiceId =
  | 'work_technology'
  | 'daily_life'
  | 'opinions_debates'
  | 'plans_stories'
  | 'job_interview'
  | 'free_topic';

export type InterviewFocus =
  | 'job_interview_hr'
  | 'job_interview_behavioural'
  | 'job_interview_technical';

export type PracticeSelection = {
  readonly mode: PracticeMode;
  readonly topic: TopicChoiceId;
  readonly interviewFocus: InterviewFocus;
  readonly customTopic: string;
  readonly duration: DurationGoalSeconds;
};

export type PracticeOptions = {
  readonly topic_id: Exclude<TopicChoiceId, 'job_interview'> | InterviewFocus | 'random';
  readonly topic_custom: string | null;
  readonly duration_goal_seconds: DurationGoalSeconds;
  readonly practice_mode: PracticeMode;
};

export type StartStatus = 'ready' | 'restoring' | 'starting';
