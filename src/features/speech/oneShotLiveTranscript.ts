import type { PcmRecorder } from '@/audio/recordPcm';
import { startLiveTranscript } from './liveTranscript';

// Match the turn detector's minimum to keep silence below the partial-request gate.
const MIN_SPEECH_LEVEL = 0.006;

/** Starts live recognition for a one-shot recording, after its level first crosses the speech gate. */
export function startOneShotLiveTranscript(
  recorder: PcmRecorder,
  onText: (text: string) => void,
): { sampleLevel: (level: number) => void; dispose: () => void } {
  let hasHeardSpeech = false;
  const stop = startLiveTranscript(recorder, () => hasHeardSpeech, onText);
  return {
    sampleLevel(level) {
      if (level > MIN_SPEECH_LEVEL) hasHeardSpeech = true;
    },
    dispose: stop,
  };
}
