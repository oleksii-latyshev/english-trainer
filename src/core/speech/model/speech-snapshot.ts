import { AsyncResult, type AtomRegistry } from 'effect/reactivity';
import { naturalVoiceAtom, speechVoiceAtom } from '@/core/voice-preference';
import { chooseEngine } from '../helpers/engine-choice';
import { naturalAvailability } from '../helpers/natural-availability';
import { clampSpeechRate } from '../helpers/system-voices';
import type { SpeechEngineChoice } from '../types';
import { naturalAvailabilityAtom, systemVoicesAtom } from './atoms';

export function chooseEngineNow(
  registry: AtomRegistry.AtomRegistry,
  requestedVoiceURI: string | undefined,
): SpeechEngineChoice | null {
  const natural = registry.get(naturalVoiceAtom);
  const voices = registry.get(systemVoicesAtom);
  return chooseEngine({
    requestedVoiceURI,
    isNaturalReady:
      natural.engine === 'natural' &&
      naturalAvailability(registry.get(naturalAvailabilityAtom)) === 'ready',
    naturalVoiceId: natural.voiceId,
    systemVoices: AsyncResult.isSuccess(voices) ? voices.value : [],
    savedVoiceURI: registry.get(speechVoiceAtom).voiceURI,
  });
}

export function rateNow(registry: AtomRegistry.AtomRegistry): number {
  return clampSpeechRate(registry.get(speechVoiceAtom).rate);
}
