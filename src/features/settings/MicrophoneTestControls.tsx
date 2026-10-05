import { Button } from '@heroui/react';
import { MICROPHONE_TEST_DURATION_MS, type useMicrophoneTest } from '@/audio/useMicrophoneTest';
import { MicrophoneSignalDetails } from './MicrophoneSignalDetails';

export function MicrophoneTestControls({
  test,
  disabled,
  onStart,
  onRefresh,
}: {
  test: ReturnType<typeof useMicrophoneTest>;
  disabled: boolean;
  onStart: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-200">Microphone check</span>
        <span className="text-xs text-zinc-400">
          Auto-stops after {MICROPHONE_TEST_DURATION_MS / 1000} seconds
        </span>
      </div>

      {test.state.tag === 'idle' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            isDisabled={test.isCapturing || disabled}
            onPress={onStart}
            size="sm"
            variant="secondary"
          >
            Start test
          </Button>
          <Button
            isDisabled={test.isCapturing || disabled}
            onPress={onRefresh}
            size="sm"
            variant="secondary"
          >
            Refresh devices
          </Button>
        </div>
      )}

      {test.state.tag === 'requesting' && (
        <div className="flex items-center gap-3">
          <Button isDisabled size="sm" variant="secondary">
            Starting…
          </Button>
          <span className="text-xs text-zinc-400">
            Preparing microphone (about 3 seconds)… Wait for Recording before speaking.
          </span>
        </div>
      )}

      {test.state.tag === 'recording' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onPress={test.stopTest} size="sm" variant="secondary">
            Stop test
          </Button>
          <span className="text-xs text-amber-300">
            Recording…{' '}
            {Math.min(MICROPHONE_TEST_DURATION_MS / 1000, Math.ceil(test.state.elapsedMs / 1000))}s
            / {MICROPHONE_TEST_DURATION_MS / 1000}s
          </span>
          <label className="flex items-center gap-3 text-xs text-zinc-400">
            Input level
            <meter
              aria-label="Live microphone input level"
              min={0}
              max={1}
              value={test.state.level ?? 0}
            />
          </label>
        </div>
      )}

      {test.state.tag === 'stopping' && (
        <div className="flex items-center gap-3">
          <Button isDisabled size="sm" variant="secondary">
            Stopping…
          </Button>
          <span className="text-xs text-zinc-400">Finalizing test recording…</span>
        </div>
      )}

      {test.state.tag === 'recorded' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-zinc-300">
            <span>Test audio ready ({Math.round(test.state.durationMs / 1000)}s)</span>
            <span className="text-zinc-500">Not saved or transcribed</span>
          </div>
          {/* biome-ignore lint/a11y/useMediaCaption: This is the learner's unsaved microphone check; automatic transcription is deliberately excluded. */}
          <audio
            aria-label="Test microphone playback"
            className="h-10 w-full"
            controls
            src={test.state.playbackUrl}
          />
          <MicrophoneSignalDetails signal={test.state.signal} input={test.state.actualInput} />
          <div className="flex flex-wrap items-center gap-3">
            <Button onPress={test.discardTest} size="sm" variant="secondary">
              Discard
            </Button>
            <Button isDisabled={disabled} onPress={onStart} size="sm" variant="secondary">
              Record again
            </Button>
          </div>
        </div>
      )}

      {test.state.tag === 'error' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-rose-300" role="alert">
            {test.state.message}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button isDisabled={disabled} onPress={onStart} size="sm" variant="secondary">
              Try again
            </Button>
            <Button onPress={test.discardTest} size="sm" variant="secondary">
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
