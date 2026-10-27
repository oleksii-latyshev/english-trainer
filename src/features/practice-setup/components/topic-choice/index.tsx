import { ChoiceChip } from '@/shared/ui/choice-chip';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { INTERVIEW_FOCUS_CHOICES, MAX_CUSTOM_TOPIC_CHARS, TOPIC_CHOICES } from '../../constants';
import type { PracticeSelection } from '../../types';

const CUSTOM_TOPIC_ID = 'custom-topic';

type Props = {
  selection: PracticeSelection;
  onChange: (change: Partial<PracticeSelection>) => void;
  disabled: boolean;
};

export function TopicChoice({ selection, onChange, disabled }: Props) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
      <legend className="text-caption text-faint mb-3 font-semibold">Topic</legend>
      <div className="flex flex-wrap gap-2">
        {TOPIC_CHOICES.map((topic) => (
          <ChoiceChip
            disabled={disabled}
            isSelected={selection.topic === topic.id}
            key={topic.id}
            onSelect={() => onChange({ topic: topic.id })}
          >
            {topic.label}
          </ChoiceChip>
        ))}
      </div>
      {selection.topic === 'job_interview' && (
        <Select
          className="w-fit"
          disabled={disabled}
          label="Interview focus"
          onChange={(interviewFocus) => onChange({ interviewFocus })}
          options={INTERVIEW_FOCUS_CHOICES}
          value={selection.interviewFocus}
        />
      )}
      {selection.topic === 'free_topic' && (
        <label className="text-caption text-muted flex flex-col gap-1.5" htmlFor={CUSTOM_TOPIC_ID}>
          What would you like to talk about?
          <Input
            disabled={disabled}
            id={CUSTOM_TOPIC_ID}
            maxLength={MAX_CUSTOM_TOPIC_CHARS}
            onChange={(event) => onChange({ customTopic: event.target.value })}
            placeholder="For example, a book you enjoyed"
            value={selection.customTopic}
          />
          <span className="text-faint text-xs">
            {Array.from(selection.customTopic).length}/{MAX_CUSTOM_TOPIC_CHARS} characters
          </span>
        </label>
      )}
    </fieldset>
  );
}
