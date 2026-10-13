import { useEffect, useRef } from 'react';
import { useAudioInputOptions, useMicrophoneTest, usePreferredMicrophone } from '@/core/audio';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { LevelMeter } from '@/shared/ui/level-meter';
import { Notice } from '@/shared/ui/notice';
import { Select } from '@/shared/ui/select';
import {
  choiceOfDevice,
  deviceChoices,
  deviceDescription,
  deviceOfChoice,
} from '../../helpers/device-choices';
import { TestControls } from '../test-controls';

const STORAGE_FALLBACK =
  'Local storage is unavailable; device selection will only apply to the current session.';

type Props = {
  isPracticeCapturing: boolean;
  isDeviceFocused: boolean;
  onBeforeRecord: () => void;
};

export function MicrophoneSettings({
  isPracticeCapturing,
  isDeviceFocused,
  onBeforeRecord,
}: Props) {
  const deviceSelect = useRef<HTMLButtonElement | null>(null);
  const { selectedDeviceId, selectDevice, storageStatus, actualInput } = usePreferredMicrophone();
  const { deviceOptions, hasUnnamed, deviceError, loadDevices } = useAudioInputOptions();
  const test = useMicrophoneTest();
  const activeInput =
    test.state.tag === 'recording' || test.state.tag === 'stopping' || test.state.tag === 'recorded'
      ? test.state.input
      : actualInput;
  const isLocked = test.isCapturing || test.isOccupied || isPracticeCapturing;

  useEffect(() => {
    if (isDeviceFocused) deviceSelect.current?.focus({ preventScroll: true });
  }, [isDeviceFocused]);

  function handleRecord() {
    onBeforeRecord();
    test.start(selectedDeviceId);
  }

  return (
    <GroupCard id="microphone" title="Microphone">
      {isPracticeCapturing && (
        <Notice role="status" tone="warn">
          Finish the active practice recording before testing or changing the microphone.
        </Notice>
      )}
      {!storageStatus.available && (
        <Notice role="status" tone="warn">
          {storageStatus.warning || STORAGE_FALLBACK}
        </Notice>
      )}
      {deviceError && (
        <Notice role="alert" tone="error">
          {deviceError}
        </Notice>
      )}
      <FormRow
        description={deviceDescription({ hasUnnamed, lastInputLabel: activeInput?.label })}
        htmlFor="microphone-select"
        title="Input device"
      >
        <Select
          disabled={isLocked}
          id="microphone-select"
          label="Input device"
          onChange={(choice) => selectDevice(deviceOfChoice(choice))}
          options={deviceChoices(deviceOptions, selectedDeviceId)}
          triggerRef={deviceSelect}
          value={choiceOfDevice(selectedDeviceId)}
        />
        <Button disabled={isLocked} onClick={loadDevices} tone="ghost">
          Refresh
        </Button>
      </FormRow>
      <FormRow
        description="Speak normally — the bar should reach the middle. It moves while you record the check below."
        title="Level"
      >
        <LevelMeter
          label="Live microphone input level"
          level={test.state.tag === 'recording' ? test.state.level : undefined}
        />
      </FormRow>
      <TestControls isDisabled={isPracticeCapturing} onRecord={handleRecord} test={test} />
    </GroupCard>
  );
}
