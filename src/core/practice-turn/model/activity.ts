import { Deferred, Duration, Effect, Stream } from 'effect';
import { AsyncResult, Atom, type AtomRegistry } from 'effect/reactivity';
import { microphoneSnapshotAtom, WarmMicrophone } from '@/core/audio';
import { conversationFlowAtom } from '@/core/conversation-flow';
import { practiceStageUsesAudio, practiceStateAtom, sessionDetails } from '@/core/practice-session';
import { speechStateAtom } from '@/core/speech';
import { currentJoinWindow } from './continuation';
import { interruptReply } from './interrupt';
import { turnRuntime } from './runtime';
import { canVoiceInterruptAtom, joinWindowAtom, micLevelAtom } from './state';

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

const joinsContinuationAtom = Atom.make((get) => get(joinWindowAtom) !== null);

function onSpeechOnset(registry: AtomRegistry.AtomRegistry, canInterrupt: boolean) {
  const window = currentJoinWindow(registry);
  if (window !== null) {
    const { openedAtMs: _openedAtMs, ...continues } = window;
    interruptReply(registry, { record: true, retainPreRoll: true, continues });
    return;
  }
  if (canInterrupt) interruptReply(registry, { record: true, retainPreRoll: true });
}

export const microphoneActivityAtom = turnRuntime.atom((get) => {
  const isReady = get(isMicrophoneReadyAtom);
  const isEnabled = get(audioStageAtom);
  const detects = get(detectsInterruptionAtom);
  const joins = get(joinsContinuationAtom);
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
    const listensForOnset = canInterrupt || joins;
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
      .speechOnsets({ isEnabled: Effect.succeed(listensForOnset) })
      .pipe(Stream.runForEach(() => Effect.sync(() => onSpeechOnset(registry, canInterrupt))));
    yield* Effect.all([levels, onsets], { concurrency: 'unbounded', discard: true });
  }).pipe(Effect.ignore);
});
