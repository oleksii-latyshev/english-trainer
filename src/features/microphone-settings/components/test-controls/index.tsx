import { Mic } from 'lucide-react';
import type { useMicrophoneTest } from '@/core/audio';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { recordLabel, testDescription } from '../../helpers/test-copy';
import { PlayBack } from '../play-back';
import { SignalDetails } from '../signal-details';

type Props = {
  test: ReturnType<typeof useMicrophoneTest>;
  isDisabled: boolean;
  onRecord: () => void;
};

export function TestControls({ test, isDisabled, onRecord }: Props) {
  const { state } = test;
  return (
    <>
      <FormRow description={testDescription(state)} title="10-second check">
        {state.tag === 'recording' ? (
          <Button onClick={test.stop} tone="secondary">
            Stop
          </Button>
        ) : (
          <Button disabled={isDisabled || test.isOccupied} onClick={onRecord} tone="secondary">
            <Mic aria-hidden="true" />
            {recordLabel(state)}
          </Button>
        )}
        {state.tag === 'recorded' && (
          <>
            <PlayBack url={state.playbackUrl} />
            <Button onClick={test.discard} tone="ghost">
              Discard
            </Button>
          </>
        )}
        {state.tag === 'error' && (
          <Button onClick={test.discard} tone="ghost">
            Dismiss
          </Button>
        )}
      </FormRow>
      {state.tag === 'recorded' && <SignalDetails input={state.input} signal={state.signal} />}
    </>
  );
}
