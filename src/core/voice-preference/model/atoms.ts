import { Atom } from 'effect/reactivity';
import { NaturalVoiceSchema, SpeechVoiceSchema } from '../helpers/voice-preference-schema';
import { DEFAULT_NATURAL_VOICE, DEFAULT_SPEECH_VOICE } from '../voice-preference';
import { voicePreferenceRuntime } from './runtime';

const NATURAL_VOICE_KEY = 'english_trainer_natural_voice';
const SPEECH_VOICE_KEY = 'english_trainer_voice';

export const naturalVoiceAtom = Atom.kvs({
  runtime: voicePreferenceRuntime,
  key: NATURAL_VOICE_KEY,
  schema: NaturalVoiceSchema,
  defaultValue: () => DEFAULT_NATURAL_VOICE,
  mode: 'sync',
});

export const speechVoiceAtom = Atom.kvs({
  runtime: voicePreferenceRuntime,
  key: SPEECH_VOICE_KEY,
  schema: SpeechVoiceSchema,
  defaultValue: () => DEFAULT_SPEECH_VOICE,
  mode: 'sync',
});
