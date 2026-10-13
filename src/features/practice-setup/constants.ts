import type {
  DurationGoalSeconds,
  InterviewFocus,
  PracticeMode,
  PracticeSelection,
  TopicChoiceId,
} from './types';

export const MAX_CUSTOM_TOPIC_CHARS = 150;

export const DEFAULT_SELECTION: PracticeSelection = {
  mode: 'voice',
  topic: 'work_technology',
  interviewFocus: 'job_interview_hr',
  customTopic: '',
  duration: 600,
};

export const MODE_CHOICES: readonly {
  readonly id: PracticeMode;
  readonly title: string;
  readonly description: string;
}[] = [
  { id: 'voice', title: 'Speak', description: 'Speak with Eva and hear her replies.' },
  { id: 'text_chat', title: 'Text chat', description: 'Write a conversation with Eva.' },
  {
    id: 'write_then_speak',
    title: 'Write, then speak',
    description: 'Write first, review, then answer aloud.',
  },
];

export const TOPIC_CHOICES: readonly { readonly id: TopicChoiceId; readonly label: string }[] = [
  { id: 'work_technology', label: 'Work & technology' },
  { id: 'daily_life', label: 'Daily life' },
  { id: 'opinions_debates', label: 'Opinions & debates' },
  { id: 'plans_stories', label: 'Plans & stories' },
  { id: 'job_interview', label: 'Job interview' },
  { id: 'free_topic', label: 'Free topic' },
];

export const INTERVIEW_FOCUS_CHOICES: readonly {
  readonly value: InterviewFocus;
  readonly label: string;
}[] = [
  { value: 'job_interview_hr', label: 'HR' },
  { value: 'job_interview_behavioural', label: 'Behavioural' },
  { value: 'job_interview_technical', label: 'Technical' },
];

export const LENGTH_CHOICES: readonly {
  readonly value: DurationGoalSeconds;
  readonly label: string;
}[] = [
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
];
