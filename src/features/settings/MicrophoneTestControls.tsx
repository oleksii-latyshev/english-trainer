import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { MicrophoneSignalDetails } from './MicrophoneSignalDetails';
import { MICROPHONE_TEST_DURATION_MS, type useMicrophoneTest } from './useMicrophoneTest';

type Test = ReturnType<typeof useMicrophoneTest>;

function testDescription(test: Test): string {
  const seconds = MICROPHONE_TEST_DURATION_MS / 1000;
  switch (test.state.tag) {
    case 'idle':
      return `Record yourself, then listen back. It stops by itself after ${seconds} seconds.`;
    case 'requesting':
      return 'Preparing the microphone (about 3 seconds). Wait for Recording before speaking.';
    case 'recording':
      return `Recording… ${Math.min(seconds, Math.ceil(test.state.elapsedMs / 1000))} s of ${seconds} s.`;
    case 'stopping':
      return 'Finishing the recording…';
    case 'recorded':
      return `Ready to play back (${Math.round(test.state.durationMs / 1000)} s). Not saved or transcribed.`;
    case 'error':
      return test.state.message;
  }
}

function PlayBack({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handleToggle() {
    const element = audio.current;
    if (!element) return;
    if (isPlaying) {
      element.pause();
      element.currentTime = 0;
      return;
    }
    // A blocked or failed play leaves the button as "Play back" so the learner can try again.
    element.play().catch(() => setIsPlaying(false));
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: This is the learner's unsaved microphone check; automatic transcription is deliberately excluded. */}
      <audio
        aria-label="Test microphone playback"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        ref={audio}
        src={url}
      />
      <Button onClick={handleToggle} tone="ghost">
        {isPlaying ? 'Stop' : 'Play back'}
      </Button>
    </>
  );
}

export function MicrophoneTestControls({
  test,
  disabled,
  onStart,
}: {
  test: Test;
  disabled: boolean;
  onStart: () => void;
}) {
  const { state } = test;
  const isBusy = state.tag === 'requesting' || state.tag === 'stopping';
  return (
    <>
      <FormRow description={testDescription(test)} title="10-second check">
        {state.tag === 'recording' ? (
          <Button onClick={test.stopTest}>Stop</Button>
        ) : (
          <Button disabled={disabled || isBusy || test.isCapturing} onClick={onStart}>
            {state.tag === 'recorded' || state.tag === 'error' ? 'Record again' : 'Record'}
          </Button>
        )}
        {state.tag === 'recorded' && (
          <>
            <PlayBack url={state.playbackUrl} />
            <Button onClick={test.discardTest} tone="ghost">
              Discard
            </Button>
          </>
        )}
        {state.tag === 'error' && (
          <Button onClick={test.discardTest} tone="ghost">
            Dismiss
          </Button>
        )}
      </FormRow>
      {state.tag === 'recorded' && (
        <Notice tone="quiet">
          <MicrophoneSignalDetails input={state.actualInput} signal={state.signal} />
        </Notice>
      )}
    </>
  );
}
