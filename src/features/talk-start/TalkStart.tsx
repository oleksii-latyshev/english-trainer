import { Button } from '@heroui/react';
import { Bookmark, Clock, Mic, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Eva } from '@/components/eva/Eva';
import type { DueCount } from '@/features/memory/useDuePhraseCount';
import {
  DEFAULT_PRACTICE_OPTIONS,
  type DurationGoalSeconds,
  type PracticeOptions,
  TOPICS,
  type TopicId,
  topicLabel,
} from '@/lib/practiceOptions';
import {
  PRIMARY_ACTION_LABEL,
  primaryAction,
  resumeDetail,
  reviewHint,
  reviewTitle,
} from './lib/talkStartState';
import './talkStart.css';

type Props = {
  isBusy: boolean;
  error: string;
  isRestoring: boolean;
  due: DueCount;
  openSession?: Parameters<typeof resumeDetail>[0];
  onStartOrResume: () => void;
  onStart: (options: PracticeOptions) => void;
  onOpenMemory: () => void;
};

const VISIBLE_TOPICS = TOPICS.filter((topic) =>
  ['work_technology', 'daily_life', 'opinions_debates', 'plans_stories', 'free_topic'].includes(
    topic.id,
  ),
);

export function TalkStart({
  isBusy,
  error,
  isRestoring,
  due,
  openSession,
  onStartOrResume,
  onStart,
  onOpenMemory,
}: Props) {
  const [topicId, setTopicId] = useState<TopicId>(DEFAULT_PRACTICE_OPTIONS.topic_id);
  const [interviewTopic, setInterviewTopic] = useState<TopicId>('job_interview_hr');
  const [customTopic, setCustomTopic] = useState('');
  const [duration, setDuration] = useState<DurationGoalSeconds>(
    DEFAULT_PRACTICE_OPTIONS.duration_goal_seconds,
  );
  const action = primaryAction({
    isRestoring,
    isBusy,
    hasActiveSession: openSession !== undefined,
  });
  const effectiveTopicId = topicId === 'job_interview_hr' ? interviewTopic : topicId;
  const chosenLabel = topicLabel(effectiveTopicId, customTopic);
  const isCustomTopicValid =
    topicId !== 'free_topic' ||
    (customTopic.trim().length > 0 && Array.from(customTopic.trim()).length <= 150);

  function start(selectedId: TopicId) {
    const useCustom = selectedId === 'free_topic';
    onStart({
      topic_id: selectedId,
      topic_custom: useCustom ? customTopic.trim() : null,
      duration_goal_seconds: duration,
    });
  }

  return (
    <div className="talk-start">
      <header className="talk-start-greeting">
        <Eva decorative mood="happy" size={88} />
        <div className="talk-start-greeting-copy">
          <h1>What shall we talk about?</h1>
          <p>
            Choose a topic and a suggested length. Eva will ask short questions; answer out loud and
            get quiet notes as you go.
          </p>
        </div>
      </header>

      {openSession && (
        <section aria-label="Open conversation" className="talk-start-card">
          <Clock aria-hidden="true" className="talk-start-card-icon talk-start-icon-me" size={20} />
          <div className="talk-start-card-copy">
            <div className="talk-start-card-title">Continue: {openSession.topicLabel}</div>
            <div className="talk-start-card-hint">{resumeDetail(openSession)}</div>
          </div>
          <Button
            className="talk-start-card-action"
            isDisabled={isRestoring}
            onPress={onStartOrResume}
            variant="secondary"
          >
            Continue
          </Button>
        </section>
      )}

      {due.tag === 'ready' && (
        <section aria-label="Phrases to review" className="talk-start-card">
          <Bookmark
            aria-hidden="true"
            className="talk-start-card-icon talk-start-icon-accent"
            size={20}
          />
          <div className="talk-start-card-copy">
            <div className="talk-start-card-title">{reviewTitle(due.dueCount)}</div>
            <div className="talk-start-card-hint">{reviewHint(due.dueCount)}</div>
          </div>
          {due.dueCount > 0 && (
            <Button className="talk-start-card-action" onPress={onOpenMemory} variant="secondary">
              Review now
            </Button>
          )}
        </section>
      )}

      {!openSession && (
        <fieldset className="talk-start-options" disabled={isBusy || isRestoring}>
          <legend className="talk-start-section-title">Choose a topic</legend>
          <div className="talk-topic-grid">
            {VISIBLE_TOPICS.map((topic) => (
              <button
                aria-pressed={topicId === topic.id}
                className="talk-topic-option"
                key={topic.id}
                onClick={() => setTopicId(topic.id)}
                type="button"
              >
                <span className="talk-topic-option-title">{topic.label}</span>
                <span className="talk-topic-option-description">{topic.description}</span>
              </button>
            ))}
            <button
              aria-pressed={topicId === 'job_interview_hr'}
              className="talk-topic-option"
              onClick={() => setTopicId('job_interview_hr')}
              type="button"
            >
              <span className="talk-topic-option-title">Job interview</span>
              <span className="talk-topic-option-description">
                Practice a focused interview conversation.
              </span>
            </button>
          </div>

          {topicId === 'job_interview_hr' && (
            <label className="talk-start-inline-field">
              Interview focus
              <select
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value === 'job_interview_hr' ||
                    value === 'job_interview_behavioural' ||
                    value === 'job_interview_technical'
                  )
                    setInterviewTopic(value);
                }}
                value={interviewTopic}
              >
                <option value="job_interview_hr">HR</option>
                <option value="job_interview_behavioural">Behavioural</option>
                <option value="job_interview_technical">Technical</option>
              </select>
            </label>
          )}

          {topicId === 'free_topic' && (
            <label className="talk-start-free-topic">
              What would you like to talk about?
              <input
                maxLength={150}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomTopic(value);
                }}
                placeholder="For example, a book you enjoyed"
                value={customTopic}
              />
              <span>{Array.from(customTopic).length}/150 characters</span>
            </label>
          )}

          <div className="talk-start-length">
            <div>
              <div className="talk-start-section-title">Suggested length</div>
              <p>Keep talking for as long as you like.</p>
            </div>
            <fieldset className="talk-start-length-options">
              <legend className="sr-only">Suggested session length</legend>
              {([300, 600, 900] as const).map((seconds) => (
                <button
                  aria-pressed={duration === seconds}
                  key={seconds}
                  onClick={() => setDuration(seconds)}
                  type="button"
                >
                  {seconds / 60} min
                </button>
              ))}
            </fieldset>
          </div>

          <div className="talk-start-summary" aria-live="polite">
            Topic: <strong>{chosenLabel}</strong> · Suggested length:{' '}
            <strong>{duration / 60} minutes</strong>
          </div>
          <div className="talk-start-primary">
            <Button
              className="talk-start-cta"
              isDisabled={isBusy || !isCustomTopicValid}
              onPress={() => start(effectiveTopicId)}
              variant="primary"
            >
              <Mic aria-hidden="true" size={18} strokeWidth={2.2} />
              {PRIMARY_ACTION_LABEL[action]}
            </Button>
            <Button
              className="talk-start-random"
              isDisabled={isBusy}
              onPress={() => start('random')}
              variant="secondary"
            >
              Random topic
            </Button>
          </div>
        </fieldset>
      )}

      {error && (
        <div className="talk-start-notice" role="alert">
          <TriangleAlert aria-hidden="true" size={18} />
          <span>{error}</span>
          {!openSession && (
            <Button
              isDisabled={isBusy}
              onPress={() => start(effectiveTopicId)}
              size="sm"
              variant="secondary"
            >
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
