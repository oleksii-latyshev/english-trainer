import { Layer } from 'effect';
import { CoreLive } from '@/core/runtime';
import { SpeechRecognition } from '../services/speech-recognition-service';
import { SpeechRecognitionSettings } from '../services/speech-recognition-settings-service';

export const SpeechRecognitionLive = Layer.mergeAll(
  SpeechRecognition.layer,
  SpeechRecognitionSettings.layer,
).pipe(Layer.provide(CoreLive));
