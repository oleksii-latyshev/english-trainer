import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { Diagnostics } from '@/core/diagnostics';
import { CoreLive } from '@/core/runtime';
import { AudioOutput } from '../services/audio-output-service';
import { NaturalVoice } from '../services/natural-voice-service';
import { Speech } from '../services/speech-service';
import { SystemVoice } from '../services/system-voice-service';

const Edges = Layer.mergeAll(
  Diagnostics.layer.pipe(Layer.provide(CoreLive)),
  NaturalVoice.layer.pipe(Layer.provide(CoreLive)),
  AudioOutput.layer,
  SystemVoice.layer,
);

const SpeechLive = Speech.layer.pipe(Layer.provide(Edges));

export const runtime = Atom.runtime(SpeechLive);
