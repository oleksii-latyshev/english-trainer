import { useEffect, useState } from 'react';
import {
  microphoneTestFailureMessage,
  useAudioInputOptions,
  useMicrophoneTest,
  usePreferredMicrophone,
} from '@/core/audio';
import { Notice } from '@/shared/ui/notice';
import { checkStatus, isHearingSpeech } from '../../helpers/heard-speech';
import { AllowMicrophone } from './allow-microphone';
import { CheckList } from './check-list';

type Props = {
  isPracticeCapturing: boolean;
  isAllowed: boolean;
  onAllowed: () => void;
  onBeforeStart: () => void;
  onListeningChange: (isListening: boolean) => void;
};

function useHeardSpeech(level: number | undefined, isRestarting: boolean): boolean {
  const [heard, setHeard] = useState(false);
  if (!heard && isHearingSpeech(level)) setHeard(true);
  if (heard && isRestarting) setHeard(false);
  return heard;
}

export function MicrophoneCheck({
  isPracticeCapturing,
  isAllowed,
  onAllowed,
  onBeforeStart,
  onListeningChange,
}: Props) {
  const { selectedDeviceId, selectDevice } = usePreferredMicrophone();
  const { deviceOptions, hasUnnamed, deviceError } = useAudioInputOptions();
  const test = useMicrophoneTest();
  const { state } = test;
  const isListening = state.tag === 'recording';
  const level = state.tag === 'recording' ? state.level : undefined;
  const heard = useHeardSpeech(level, state.tag === 'requesting');
  const isLocked = test.isCapturing || test.isOccupied || isPracticeCapturing;
  const isCheckShown = isAllowed || isListening || state.tag === 'recorded';

  useEffect(() => {
    onListeningChange(isListening);
    if (isListening) onAllowed();
  }, [isListening, onAllowed, onListeningChange]);

  function startCheck() {
    onBeforeStart();
    test.start(selectedDeviceId);
  }

  return (
    <div className="flex flex-col gap-2">
      {isPracticeCapturing && (
        <Notice role="status" tone="warn">
          Finish the active practice recording before testing the microphone.
        </Notice>
      )}
      {state.tag === 'error' && (
        <Notice role="alert" tone="error">
          {microphoneTestFailureMessage(state.failure)}
        </Notice>
      )}
      {deviceError && (
        <Notice role="alert" tone="error">
          {deviceError}
        </Notice>
      )}
      {isCheckShown ? (
        <CheckList
          deviceOptions={deviceOptions}
          hasUnnamed={hasUnnamed}
          isLocked={isLocked}
          level={level}
          onCheckAgain={startCheck}
          onSelectDevice={selectDevice}
          selectedDeviceId={selectedDeviceId}
          status={checkStatus(state.tag, heard)}
        />
      ) : (
        <AllowMicrophone
          isDisabled={isLocked}
          isPreparing={state.tag === 'requesting'}
          onAllow={startCheck}
        />
      )}
    </div>
  );
}
