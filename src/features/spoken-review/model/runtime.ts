import { Layer } from 'effect';
import { AudioLive, audioAtomContext } from '@/core/audio';
import { SpeechRecognitionLive } from '@/core/speech';
import { AnswerCapture } from '../services/answer-capture-service';

const CaptureLive = AnswerCapture.layer.pipe(
  Layer.provideMerge(SpeechRecognitionLive),
  Layer.provideMerge(AudioLive),
);

export const captureRuntime = audioAtomContext(CaptureLive);
