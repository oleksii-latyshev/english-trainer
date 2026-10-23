import type { AtomRegistry } from 'effect/reactivity';
import type { RecordedAudio } from '@/core/audio';
import type { Recording } from '../types';
import { recordedClipAtom } from './state';

export function discardRecording(registry: AtomRegistry.AtomRegistry) {
  const clip = registry.get(recordedClipAtom);
  if (clip === null) return;
  URL.revokeObjectURL(clip.playbackUrl);
  registry.set(recordedClipAtom, null);
}

export function keepRecording(
  registry: AtomRegistry.AtomRegistry,
  audio: RecordedAudio,
  speechStoppedAtMs: number,
): Recording {
  discardRecording(registry);
  const playbackUrl = URL.createObjectURL(audio.wav);
  registry.set(recordedClipAtom, { wav: audio.wav, playbackUrl });
  return { playbackUrl, durationMs: audio.durationMs, speechStoppedAtMs };
}
