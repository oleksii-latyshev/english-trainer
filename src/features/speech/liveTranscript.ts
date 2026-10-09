import { invoke } from '@tauri-apps/api/core';
import type { PcmRecorder } from '@/audio/recordPcm';
import { getSpeechEngineStatus } from '@/lib/speechTypes';
import { createLiveTicker } from './liveTicker';

/** The live transcript re-runs the model on the audio so far this often. */
const LIVE_INTERVAL_MS = 1500;

async function transcribePartial(wav: Blob): Promise<string | null> {
  const result: unknown = await invoke<unknown>(
    'transcribe_partial',
    new Uint8Array(await wav.arrayBuffer()),
  );
  return typeof result === 'string' ? result : null;
}

/**
 * Shows what the learner has said so far while the recording goes on. It runs only when the
 * model is kept loaded and small enough for it (Rust says so); otherwise it does nothing, and
 * the answer is transcribed in full after recording as before. Returns the function that ends it.
 */
export function startLiveTranscript(
  recorder: PcmRecorder,
  hasHeardSpeech: () => boolean,
  onText: (text: string) => void,
): () => void {
  let isEnded = false;
  let stopTicking = () => {};
  getSpeechEngineStatus().then(
    (status) => {
      if (isEnded || status.server !== 'ready' || !status.is_live_transcript_available) return;
      const ticker = createLiveTicker({
        isWanted: hasHeardSpeech,
        snapshot: recorder.snapshot,
        transcribe: transcribePartial,
        onText,
      });
      const timer = setInterval(() => void ticker.tick(), LIVE_INTERVAL_MS);
      stopTicking = () => {
        clearInterval(timer);
        ticker.stop();
      };
    },
    () => {
      // Without the status there is no live text; the final transcription is unaffected.
    },
  );
  return () => {
    isEnded = true;
    stopTicking();
  };
}
