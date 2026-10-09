import type { SpeechEngineStatus, SpeechSettings } from '@/lib/speechTypes';

export function engineLabel(status: SpeechEngineStatus): string {
  if (status.server === 'ready') return 'Kept loaded · ready';
  if (status.server === 'loading') return 'Loading…';
  return 'Not running (using one-off runs)';
}

/** Why the model is not kept loaded, when it should have been; empty otherwise. */
export function engineProblem(status: SpeechEngineStatus): string {
  return status.server === 'not_running' && status.failure ? status.failure : '';
}

export function liveTranscriptDescription(
  settings: SpeechSettings,
  status: SpeechEngineStatus | undefined,
): string {
  if (!settings.live_transcript) {
    return 'Off: your words appear only after you finish speaking.';
  }
  if (status && !status.is_live_transcript_available) {
    return 'On, but the chosen model is too slow to follow your speech. Choose small.en or base.en to see your words while you speak.';
  }
  return 'On: your words appear while you speak. The final text is still transcribed from the whole recording.';
}
