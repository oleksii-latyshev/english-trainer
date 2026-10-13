import { Layer } from 'effect';
import { AudioLive, audioAtomContext } from '@/core/audio';
import { SpeechRecognitionLive } from '@/core/speech';
import { SentenceRecording } from '../services/sentence-recording-service';

export const FeatureLive = SentenceRecording.layer.pipe(
  Layer.provideMerge(SpeechRecognitionLive),
  Layer.provide(AudioLive),
);

export const runtime = audioAtomContext(FeatureLive);
