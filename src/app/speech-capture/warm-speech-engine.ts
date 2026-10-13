import { Effect } from 'effect';
import { SpeechRecognition } from '@/core/speech';
import { settleSpeech } from './settle-speech';

export function warmSpeechEngine() {
  return settleSpeech(Effect.flatMap(SpeechRecognition, (recognition) => recognition.warm));
}
