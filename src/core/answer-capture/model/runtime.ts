import { Layer } from 'effect';
import { AudioLive, audioAtomContext } from '@/core/audio';
import { SpeechRecognitionLive } from '@/core/speech';
import { AnswerRecorder } from '../services/answer-recorder-service';

export const AnswerCaptureLive = AnswerRecorder.layer.pipe(
  Layer.provideMerge(SpeechRecognitionLive),
  Layer.provideMerge(AudioLive),
);

export const captureRuntime = audioAtomContext(AnswerCaptureLive);
