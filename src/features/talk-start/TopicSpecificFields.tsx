import type { Dispatch, SetStateAction } from 'react';
import type { TopicId } from '@/lib/practiceOptions';

export function TopicSpecificFields({
  topicId,
  interviewTopic,
  setInterviewTopic,
  customTopic,
  setCustomTopic,
}: {
  topicId: TopicId;
  interviewTopic: TopicId;
  setInterviewTopic: Dispatch<SetStateAction<TopicId>>;
  customTopic: string;
  setCustomTopic: Dispatch<SetStateAction<string>>;
}) {
  return (
    <>
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
            onChange={(event) => setCustomTopic(event.target.value)}
            placeholder="For example, a book you enjoyed"
            value={customTopic}
          />
          <span>{Array.from(customTopic).length}/150 characters</span>
        </label>
      )}
    </>
  );
}
