import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import type { AudioInputOption } from '@/audio/types';
import { useAudioInputOptions } from '@/audio/useAudioInputOptions';
import { useMicrophoneTest } from '@/audio/useMicrophoneTest';
import { Eva } from '@/components/eva/Eva';
import { useTrainer } from '@/context/TrainerContext';
import { LevelMeter } from '@/features/settings/LevelMeter';
import { MicrophoneDeviceSelect } from '@/features/settings/MicrophoneDeviceSelect';
import { checkStatus, isHearingSpeech } from './lib/heardSpeech';

type CardProps = {
  deviceOptions: AudioInputOption[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  hasUnnamed: boolean;
  isBusy: boolean;
  level: number | undefined;
  status: { ok: boolean; text: string };
  /** Offer "Check again" once the previous check is over. */
  canCheckAgain: boolean;
  onCheck: () => void;
};

function MicrophoneCheckCard({
  deviceOptions,
  selectedDeviceId,
  onSelectDevice,
  hasUnnamed,
  isBusy,
  level,
  status,
  canCheckAgain,
  onCheck,
}: CardProps) {
  return (
    <section aria-label="Microphone check" className="first-run-card">
      <div className="first-run-field-group">
        <label className="first-run-label" htmlFor="first-run-device">
          Microphone
        </label>
        <MicrophoneDeviceSelect
          className="first-run-select"
          disabled={isBusy}
          id="first-run-device"
          onSelect={onSelectDevice}
          options={deviceOptions}
          selectedDeviceId={selectedDeviceId}
        />
        {hasUnnamed && (
          <p className="first-run-hint">
            macOS hides microphone names until the first check; they appear after it.
          </p>
        )}
      </div>
      <div className="first-run-meter-row">
        <LevelMeter level={level} />
        {status.ok ? (
          <span className="first-run-ok" role="status">
            <Check aria-hidden="true" size={14} strokeWidth={2.4} />
            {status.text}
          </span>
        ) : (
          <span className="first-run-hint" role="status">
            {status.text}
          </span>
        )}
      </div>
      <p className="first-run-hint">Say a sentence — for example, what you did this morning.</p>
      {canCheckAgain && (
        <div>
          <button className="first-run-button" onClick={onCheck} type="button">
            Check again
          </button>
        </div>
      )}
    </section>
  );
}

/** Latches "we can hear you" once the level shows speech; a new check starts over. */
function useHeardSpeech(level: number | undefined, isRestarting: boolean): boolean {
  const [heard, setHeard] = useState(false);
  if (!heard && isHearingSpeech(level)) setHeard(true);
  if (heard && isRestarting) setHeard(false);
  return heard;
}

function AllowMicrophone({
  isPreparing,
  isDisabled,
  onAllow,
}: {
  isPreparing: boolean;
  isDisabled: boolean;
  onAllow: () => void;
}) {
  return (
    <>
      <div className="first-run-center">
        <button
          className="first-run-button first-run-button-primary first-run-button-large"
          disabled={isDisabled}
          onClick={onAllow}
          type="button"
        >
          {isPreparing ? 'Preparing the microphone…' : 'Allow microphone'}
        </button>
      </div>
      <p className="first-run-hint first-run-center-text">macOS will ask for permission once.</p>
    </>
  );
}

/**
 * Step 1. Opening the microphone is the learner's explicit action here ("Allow microphone"); the
 * check records through the same one-shot session as the Settings check and releases the device
 * when it ends, on "Check again" or when the learner leaves the step.
 */
export function MicrophoneStep({
  allowed,
  onAllowed,
}: {
  /** Remembered by the flow so coming back to this step does not ask again. */
  allowed: boolean;
  onAllowed: () => void;
}) {
  const { speech, capture } = useTrainer();
  const { selectedDeviceId, selectDevice } = usePreferredMicrophone();
  const { deviceOptions, hasUnnamed, deviceError, loadDevices } = useAudioInputOptions();
  const test = useMicrophoneTest(selectedDeviceId, () => {
    void loadDevices();
  });
  const state = test.state;
  const level = state.tag === 'recording' ? state.level : undefined;
  const heard = useHeardSpeech(level, state.tag === 'requesting');

  useEffect(() => {
    if (state.tag === 'recording') onAllowed();
  }, [state.tag, onAllowed]);

  const practiceCapturing = !capture.canChangeSession;
  const isPreparing = state.tag === 'requesting';
  const showCheck = allowed || state.tag === 'recording' || state.tag === 'recorded';

  function startCheck() {
    speech.stop();
    void test.startTest();
  }

  return (
    <>
      <div className="first-run-hero">
        <Eva decorative mood={state.tag === 'recording' ? 'listening' : 'idle'} size={132} />
        <div className="first-run-copy">
          <h1>First, let's hear you</h1>
          <p>
            English Trainer is a speaking app. Speech is turned into text on this Mac; audio is not
            kept.
          </p>
        </div>
      </div>

      {practiceCapturing && (
        <p className="first-run-alert" role="status">
          Finish the active practice recording before testing the microphone.
        </p>
      )}

      {!showCheck && (
        <AllowMicrophone
          isDisabled={practiceCapturing || test.isCapturing}
          isPreparing={isPreparing}
          onAllow={startCheck}
        />
      )}

      {state.tag === 'error' && (
        <p className="first-run-alert" role="alert">
          {state.message}
        </p>
      )}
      {deviceError && (
        <p className="first-run-alert" role="alert">
          {deviceError}
        </p>
      )}

      {showCheck && (
        <MicrophoneCheckCard
          canCheckAgain={!practiceCapturing && !test.isCapturing}
          deviceOptions={deviceOptions}
          hasUnnamed={hasUnnamed}
          isBusy={test.isCapturing || practiceCapturing}
          level={level}
          onCheck={startCheck}
          onSelectDevice={selectDevice}
          selectedDeviceId={selectedDeviceId}
          status={checkStatus(state.tag, heard)}
        />
      )}
    </>
  );
}
