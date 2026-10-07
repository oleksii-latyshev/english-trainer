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
    <details className="settings-details">
      <summary>Recording check details</summary>
      <div className="settings-details-body">
        <p>
          Recorded {(signal.capturedMs / 1000).toFixed(1)}s during{' '}
          {(signal.elapsedMs / 1000).toFixed(1)}s of recording time. Levels below describe captured
          sound, including pauses; they do not determine whether you were speaking.
        </p>
        <div className="settings-details-body">
          {signal.windows.map((window) => (
            <div className="settings-signal-row" key={window.offsetMs}>
              <span>
                {(window.offsetMs / 1000).toFixed(0)}–
                {((window.offsetMs + window.durationMs) / 1000).toFixed(1)}s
              </span>
              <meter
                aria-label={`Captured sound level at ${window.offsetMs / 1000} seconds`}
                max={1}
                min={0}
                value={signalMeterValue(window.rms)}
              />
              <span>
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
