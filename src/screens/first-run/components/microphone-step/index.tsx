import { useState } from 'react';
import { MicrophoneCheck } from '@/features/microphone-settings';
import { StepLayout } from '../step-layout';

type Props = {
  isPracticeCapturing: boolean;
  isAllowed: boolean;
  onAllowed: () => void;
  onBeforeStart: () => void;
};

export function MicrophoneStep({
  isPracticeCapturing,
  isAllowed,
  onAllowed,
  onBeforeStart,
}: Props) {
  const [isListening, setIsListening] = useState(false);
  return (
    <StepLayout mood={isListening ? 'listening' : 'idle'} step="microphone">
      <MicrophoneCheck
        isAllowed={isAllowed}
        isPracticeCapturing={isPracticeCapturing}
        onAllowed={onAllowed}
        onBeforeStart={onBeforeStart}
        onListeningChange={setIsListening}
      />
    </StepLayout>
  );
}
