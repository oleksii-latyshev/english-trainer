import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import { useAudioInputOptions } from '@/audio/useAudioInputOptions';
import { useMicrophoneTest } from '@/audio/useMicrophoneTest';
import { useTrainer } from '@/context/TrainerContext';
import { LevelMeter } from './LevelMeter';
import { MicrophoneDeviceSelect } from './MicrophoneDeviceSelect';
import { MicrophoneTestControls } from './MicrophoneTestControls';
import { SettingsButton } from './SettingsControls';
import { SettingsBlock, SettingsGroup, SettingsRow } from './SettingsGroup';

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
    <SettingsGroup id="microphone" title="Microphone">
      {practiceCapturing && (
        <SettingsBlock role="status" tone="warn">
          Finish the active practice recording before testing or changing the microphone.
        </SettingsBlock>
      )}
      {!storageStatus.available && (
        <SettingsBlock role="status" tone="warn">
          {storageStatus.warning ||
            'Local storage is unavailable; device selection will only apply to the current session.'}
        </SettingsBlock>
      )}
      {deviceError && (
        <SettingsBlock role="alert" tone="error">
          {deviceError}
        </SettingsBlock>
      )}

      <SettingsRow
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
        <SettingsButton
          disabled={test.isCapturing || practiceCapturing}
          onClick={() => void loadDevices()}
          variant="ghost"
        >
          Refresh
        </SettingsButton>
      </SettingsRow>

      <SettingsRow
        description="Speak normally — the bar should reach the middle. It moves while you record the check below."
        title="Level"
      >
        <LevelMeter level={test.state.tag === 'recording' ? test.state.level : undefined} />
      </SettingsRow>

      <MicrophoneTestControls
        disabled={practiceCapturing}
        onStart={() => {
          speech.stop();
          void test.startTest();
        }}
        test={test}
      />
    </SettingsGroup>
  );
}
