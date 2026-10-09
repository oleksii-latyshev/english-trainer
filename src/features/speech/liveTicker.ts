/**
 * One live-transcript update at a time. The ticker re-transcribes the audio captured so far;
 * a tick that finds the previous one still running is skipped, so a slow update never queues up
 * behind itself, and nothing arrives after `stop`. The final transcription is separate and
 * authoritative, so a failed or missed update only means a stale bubble.
 */
export function createLiveTicker(deps: {
  /** False while there is nothing to show yet (no speech heard), so silence is not transcribed. */
  isWanted: () => boolean;
  snapshot: () => Promise<Blob | null>;
  transcribe: (wav: Blob) => Promise<string | null>;
  onText: (text: string) => void;
}) {
  let isRunning = false;
  let isStopped = false;
  return {
    async tick() {
      if (isRunning || isStopped || !deps.isWanted()) return;
      isRunning = true;
      try {
        const wav = await deps.snapshot();
        if (!wav || isStopped) return;
        const text = await deps.transcribe(wav);
        if (text && !isStopped) deps.onText(text);
      } catch {
        // A missed live update is harmless: the final transcription does not depend on it.
      } finally {
        isRunning = false;
      }
    },
    stop() {
      isStopped = true;
    },
  };
}
