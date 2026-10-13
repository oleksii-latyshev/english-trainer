import { type ActualAudioInput, type AudioSignalSummary, signalMeterValue } from '@/core/audio';
import { Disclosure } from '@/shared/ui/disclosure';
import {
  decibelLabel,
  processingLabel,
  secondsLabel,
  windowRangeLabel,
} from '../../helpers/signal-rows';

type Props = { signal: AudioSignalSummary; input: ActualAudioInput };

export function SignalDetails({ signal, input }: Props) {
  return (
    <Disclosure summary="Recording check details">
      <p>
        Recorded {secondsLabel(signal.capturedMs)} during {secondsLabel(signal.elapsedMs)} of
        recording time. Levels below describe captured sound, including pauses; they do not
        determine whether you were speaking.
      </p>
      <div className="flex flex-col gap-2">
        {signal.windows.map((window) => (
          <div className="flex items-center gap-3" key={window.offsetMs}>
            <span className="w-16 flex-none">{windowRangeLabel(window)}</span>
            <meter
              aria-label={`Captured sound level at ${window.offsetMs / 1000} seconds`}
              className="h-3 flex-1"
              max={1}
              min={0}
              value={signalMeterValue(window.rms)}
            />
            <span className="w-16 flex-none text-right">{decibelLabel(window.rms)}</span>
          </div>
        ))}
      </div>
      <p>
        Microphone-reported settings: echo reduction {processingLabel(input.echoCancellation)},
        noise reduction {processingLabel(input.noiseSuppression)}, automatic volume{' '}
        {processingLabel(input.autoGainControl)}. Unreported settings cannot be confirmed.
      </p>
      <p>Measurements stay in this test view. Neither sound nor measurements are saved or sent.</p>
    </Disclosure>
  );
}
