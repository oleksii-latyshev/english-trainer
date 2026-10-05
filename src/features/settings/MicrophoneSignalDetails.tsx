import { type AudioSignalSummary, signalMeterValue } from '@/audio/audioSignal';
import type { ActualAudioInput } from '@/audio/types';

function processingLabel(value?: boolean): string {
  if (value === undefined) return 'Not reported';
  return value ? 'On' : 'Off';
}

export function MicrophoneSignalDetails({
  signal,
  input,
}: {
  signal: AudioSignalSummary;
  input?: ActualAudioInput;
}) {
  return (
    <details className="text-xs text-zinc-400">
      <summary className="cursor-pointer">Recording check details</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p>
          Recorded {(signal.capturedMs / 1000).toFixed(1)}s during{' '}
          {(signal.elapsedMs / 1000).toFixed(1)}s of recording time. Levels below describe captured
          sound, including pauses; they do not determine whether you were speaking.
        </p>
        <div className="flex flex-col gap-1">
          {signal.windows.map((window) => (
            <div className="flex items-center gap-3" key={window.offsetMs}>
              <span className="w-20 shrink-0">
                {(window.offsetMs / 1000).toFixed(0)}–
                {((window.offsetMs + window.durationMs) / 1000).toFixed(1)}s
              </span>
              <meter
                aria-label={`Captured sound level at ${window.offsetMs / 1000} seconds`}
                className="h-3 flex-1"
                max={1}
                min={0}
                value={signalMeterValue(window.rms)}
              />
              <span className="w-12 text-right">
                {window.rms > 0 ? `${Math.round(20 * Math.log10(window.rms))} dB` : 'Silent'}
              </span>
            </div>
          ))}
        </div>
        <p>
          Microphone-reported settings: echo reduction {processingLabel(input?.echoCancellation)},
          noise reduction {processingLabel(input?.noiseSuppression)}, automatic volume{' '}
          {processingLabel(input?.autoGainControl)}. Unreported settings cannot be confirmed.
        </p>
        <p>
          Measurements stay in this test view. Neither sound nor measurements are saved or sent.
        </p>
      </div>
    </details>
  );
}
