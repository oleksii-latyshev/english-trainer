import { appRegistry } from '@/core/runtime';
import type { NaturalVoicePreference, SpeechVoicePreference } from '../voice-preference';
import { naturalVoiceAtom, speechVoiceAtom } from './atoms';

let areMounted = false;

function mountOnce() {
  if (areMounted) return;
  appRegistry.mount(naturalVoiceAtom);
  appRegistry.mount(speechVoiceAtom);
  areMounted = true;
}

export function readNaturalVoice(): NaturalVoicePreference {
  mountOnce();
  return appRegistry.get(naturalVoiceAtom);
}

export function readSpeechVoice(): SpeechVoicePreference {
  mountOnce();
  return appRegistry.get(speechVoiceAtom);
}
