import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import { useAudioInputOptions } from '@/audio/useAudioInputOptions';
import { useMicrophoneTest } from '@/audio/useMicrophoneTest';
import { useTrainer } from '@/context/TrainerContext';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { LevelMeter } from './LevelMeter';
import { MicrophoneDeviceSelect } from './MicrophoneDeviceSelect';
import { MicrophoneTestControls } from './MicrophoneTestControls';

export function MicrophoneSettings() {
  const { capture, speech } = useTrainer();
  const practiceCapturing = !capture.canChangeSession;
  const hash = useRouterState({ select: (state) => state.location.hash });
  const deviceSelectRef = useRef<HTMLSelectElement | null>(null);

  // Talk's "Choose microphone" lands here with #microphone: put the cursor on the device choice.
  // The page itself scrolls the group into view.
  useEffect(() => {
    if (hash !== 'microphone') return;
    deviceSelectRef.current?.focus({ preventScroll: true });
  }, [hash]);
  const { selectedDeviceId, selectDevice, storageStatus, actualInput } = usePreferredMicrophone();
  const { deviceOptions, hasUnnamed, deviceError, loadDevices } = useAudioInputOptions();
  const test = useMicrophoneTest(selectedDeviceId, () => {
    void loadDevices();
  });

  const activeActualInput =
    test.state.tag === 'recording' || test.state.tag === 'stopping' || test.state.tag === 'recorded'
      ? test.state.actualInput
      : actualInput;

  const deviceDescription = [
    hasUnnamed
      ? 'Microphone names are hidden by macOS until you record once; then they appear.'
      : undefined,
    activeActualInput
      ? `Last recorded with: ${activeActualInput.label || 'Default input'}.`
      : undefined,
  ]
    .filter((line) => line !== undefined)
    .join(' ');

  return (
    <GroupCard id="microphone" title="Microphone">
      {practiceCapturing && (
        <Notice role="status" tone="warn">
          Finish the active practice recording before testing or changing the microphone.
        </Notice>
      )}
      {!storageStatus.available && (
        <Notice role="status" tone="warn">
          {storageStatus.warning ||
            'Local storage is unavailable; device selection will only apply to the current session.'}
        </Notice>
      )}
      {deviceError && (
        <Notice role="alert" tone="error">
          {deviceError}
        </Notice>
      )}

      <FormRow
        description={deviceDescription || undefined}
        htmlFor="microphone-select"
        title="Input device"
      >
        <MicrophoneDeviceSelect
          className="settings-select"
          disabled={test.isCapturing || practiceCapturing}
          id="microphone-select"
          onSelect={selectDevice}
          options={deviceOptions}
          selectRef={deviceSelectRef}
          selectedDeviceId={selectedDeviceId}
        />
        <Button
          disabled={test.isCapturing || practiceCapturing}
          onClick={() => void loadDevices()}
          tone="ghost"
        >
          Refresh
        </Button>
      </FormRow>

      <FormRow
        description="Speak normally — the bar should reach the middle. It moves while you record the check below."
        title="Level"
      >
        <LevelMeter level={test.state.tag === 'recording' ? test.state.level : undefined} />
      </FormRow>

      <MicrophoneTestControls
        disabled={practiceCapturing}
        onStart={() => {
          speech.stop();
          void test.startTest();
        }}
        test={test}
      />
    </GroupCard>
  );
}
