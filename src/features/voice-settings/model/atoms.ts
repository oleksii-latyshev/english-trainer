import { Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { type NaturalVoiceId, speechVoiceAtom } from '@/core/voice-preference';
import { VOICE_SAMPLE } from '../helpers/voice-options';
import { VoicePreviewService } from '../services/voice-preview-service';
import { runtime } from './runtime';

export const naturalVoiceAvailabilityAtom = runtime.atom(
  Effect.gen(function* () {
    const service = yield* VoicePreviewService;
    return yield* service.prewarm;
  }),
);

const requestedVoiceAtom = Atom.make<NaturalVoiceId | null>(null);

export const previewVoiceAtom = runtime.fn(
  Effect.fn('previewVoice')(function* (voiceId: NaturalVoiceId, get: Atom.FnContext) {
    const service = yield* VoicePreviewService;
    const { rate } = get(speechVoiceAtom);
    get.set(requestedVoiceAtom, voiceId);
    yield* service.synthesize(VOICE_SAMPLE, voiceId, rate).pipe(
      Effect.flatMap(service.play),
      Effect.tapError(() => Effect.sync(() => get.refresh(naturalVoiceAvailabilityAtom))),
    );
  }),
);

export const previewingVoiceAtom = Atom.make((get) =>
  AsyncResult.isWaiting(get(previewVoiceAtom)) ? get(requestedVoiceAtom) : null,
);
