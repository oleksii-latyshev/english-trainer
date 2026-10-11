import { Keyboard, Mic } from 'lucide-react';
import type { PracticeMode, TopicId } from '@/lib/practiceOptions';
import { Button } from '@/shared/ui/button';
import { PRIMARY_ACTION_LABEL, type PrimaryAction } from './lib/talkStartState';

export function StartActions({
  action,
  practiceMode,
  isDisabled,
  isCustomTopicValid,
  onStart,
}: {
  action: PrimaryAction;
  practiceMode: PracticeMode;
  isDisabled: boolean;
  isCustomTopicValid: boolean;
  onStart: (topicId?: TopicId) => void;
}) {
  return (
    <div className="talk-start-primary">
      <Button
        className="talk-start-cta"
        disabled={isDisabled || !isCustomTopicValid}
        onClick={() => onStart()}
        tone="primary"
      >
        {practiceMode === 'voice' ? (
          <Mic aria-hidden="true" size={18} strokeWidth={2.2} />
        ) : (
          <Keyboard aria-hidden="true" size={18} strokeWidth={2.2} />
        )}
        {action === 'start' && practiceMode !== 'voice'
          ? practiceMode === 'text_chat'
            ? 'Start text chat'
            : 'Start writing'
          : PRIMARY_ACTION_LABEL[action]}
      </Button>
      <Button
        className="talk-start-random"
        disabled={isDisabled}
        onClick={() => onStart('random')}
        tone="secondary"
      >
        Random topic
      </Button>
    </div>
  );
}
