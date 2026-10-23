import { Deferred, Duration, Effect, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { microphoneSnapshotAtom, WarmMicrophone } from '@/core/audio';
import { conversationFlowAtom } from '@/core/conversation-flow';
import { practiceStageUsesAudio, practiceStateAtom, sessionDetails } from '@/core/practice-session';
import { speechStateAtom } from '@/core/speech';
import { interruptReply } from './interrupt';
import { turnRuntime } from './runtime';
import { canVoiceInterruptAtom, micLevelAtom } from './state';

const LEVEL_UPDATE = Duration.millis(100);

const isMicrophoneReadyAtom = Atom.make((get) => {
  const snapshot = AsyncResult.getOrElse(get(microphoneSnapshotAtom), () => null);
  return snapshot?.status === 'ready';
});

const audioStageAtom = Atom.make((get) => {
  const session = sessionDetails(get(practiceStateAtom));
  return session !== undefined && practiceStageUsesAudio(session);
});

const detectsInterruptionAtom = Atom.make((get) => {
  const tag = get(speechStateAtom).tag;
  return get(conversationFlowAtom).voiceInterrupt && (tag === 'speaking' || tag === 'starting');
});

export const microphoneActivityAtom = turnRuntime.atom((get) => {
  const isReady = get(isMicrophoneReadyAtom);
  const isEnabled = get(audioStageAtom);
  const detects = get(detectsInterruptionAtom);
  const { registry } = get;
  if (!isReady || !isEnabled) return Effect.void;
  return Effect.gen(function* () {
    const warm = yield* WarmMicrophone;
    const slot = yield* warm.ensure;
    if (slot === null) return;
    const session = yield* Deferred.await(slot.session);
    const hasEchoCancellation = yield* session.echoCancellationEnabled;
    const canInterrupt = detects && hasEchoCancellation;
    registry.set(canVoiceInterruptAtom, canInterrupt);
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        registry.set(canVoiceInterruptAtom, false);
        registry.set(micLevelAtom, 0);
      }),
    );
    const levels = session.levels.pipe(
      Stream.throttle({ cost: () => 1, duration: LEVEL_UPDATE, units: 1 }),
      Stream.runForEach((level) => Effect.sync(() => registry.set(micLevelAtom, level))),
    );
    const onsets = session
      .speechOnsets({ isEnabled: Effect.succeed(canInterrupt) })
      .pipe(
        Stream.runForEach(() =>
          Effect.sync(() => interruptReply(registry, { record: true, retainPreRoll: true })),
        ),
      );
    yield* Effect.all([levels, onsets], { concurrency: 'unbounded', discard: true });
  }).pipe(Effect.ignore);
});
