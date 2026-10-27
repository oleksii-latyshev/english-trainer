import { Context, Deferred, Effect, Exit, Layer, Scope, SubscriptionRef } from 'effect';
import type { MicrophoneSnapshot, MicrophoneStatus } from '../audio';
import { type MicrophoneError, microphoneDisconnected } from '../errors';
import { DevicePreference } from './device-preference-service';
import { Microphone, type MicrophoneSession } from './microphone-service';

type WarmSlot = {
  readonly scope: Scope.Closeable;
  readonly session: Deferred.Deferred<MicrophoneSession, MicrophoneError>;
};

type WarmMicrophoneShape = {
  readonly setActive: (active: boolean) => Effect.Effect<void>;
  readonly setDeviceId: (deviceId: string | undefined) => Effect.Effect<void>;
  readonly setEchoCancellation: (enabled: boolean) => Effect.Effect<void>;
  readonly pause: Effect.Effect<void>;
  readonly resume: Effect.Effect<void>;
  readonly ensure: Effect.Effect<WarmSlot | null>;
  readonly snapshot: SubscriptionRef.SubscriptionRef<MicrophoneSnapshot>;
};

type Phase = 'opening' | 'warming' | 'ready';

type ManagerState = {
  active: boolean;
  paused: boolean;
  deviceId: string | undefined;
  echoCancellation: boolean;
  slot: WarmSlot | null;
  phase: Phase;
  failure: string;
};

function statusOf(state: ManagerState): MicrophoneStatus {
  if (!state.active) return 'off';
  if (state.paused) return 'paused';
  if (state.slot) return state.phase;
  return state.failure ? 'error' : 'opening';
}

type ManagerContext = {
  readonly microphone: Context.Service.Shape<typeof Microphone>;
  readonly preference: Context.Service.Shape<typeof DevicePreference>;
  readonly layerScope: Scope.Scope;
  readonly snapshot: SubscriptionRef.SubscriptionRef<MicrophoneSnapshot>;
  readonly state: ManagerState;
};

function publish(context: ManagerContext) {
  return Effect.suspend(() => {
    const next = { status: statusOf(context.state), error: context.state.failure };
    const current = SubscriptionRef.getUnsafe(context.snapshot);
    if (next.status === current.status && next.error === current.error) return Effect.void;
    return SubscriptionRef.set(context.snapshot, next);
  });
}

function closeSlot(context: ManagerContext, slot: WarmSlot) {
  Deferred.doneUnsafe(slot.session, Effect.fail(microphoneDisconnected));
  return Effect.forkIn(Scope.close(slot.scope, Exit.void), context.layerScope).pipe(Effect.asVoid);
}

function closeCurrent(context: ManagerContext) {
  return Effect.suspend(() => {
    const slot = context.state.slot;
    context.state.slot = null;
    return slot ? closeSlot(context, slot) : Effect.void;
  });
}

function failSlot(context: ManagerContext, slot: WarmSlot, error: MicrophoneError) {
  return Effect.suspend(() => {
    if (context.state.slot !== slot) return Effect.void;
    context.state.slot = null;
    context.state.failure = error.message;
    return publish(context).pipe(Effect.andThen(closeSlot(context, slot)));
  });
}

function becomeWarm(context: ManagerContext, slot: WarmSlot, session: MicrophoneSession) {
  return session.warmed.pipe(
    Effect.andThen(
      Effect.suspend(() => {
        if (context.state.slot !== slot) return Effect.void;
        context.state.phase = 'ready';
        return publish(context);
      }),
    ),
    Effect.ignore,
  );
}

function watch(context: ManagerContext, slot: WarmSlot, session: MicrophoneSession) {
  return Effect.gen(function* () {
    yield* Deferred.succeed(slot.session, session);
    if (context.state.slot !== slot) return;
    if (context.state.phase === 'opening') {
      context.state.phase = 'warming';
      yield* publish(context);
    }
    yield* Effect.forkIn(becomeWarm(context, slot, session), slot.scope);
    return yield* session.lost;
  });
}

function openSlot(context: ManagerContext) {
  const { state } = context;
  return Effect.gen(function* () {
    state.phase = 'opening';
    const scope = yield* Scope.make();
    const slot: WarmSlot = {
      scope,
      session: yield* Deferred.make<MicrophoneSession, MicrophoneError>(),
    };
    state.slot = slot;
    const deviceId = state.deviceId ?? (yield* context.preference.current);
    const run = context.microphone
      .open({ deviceId, echoCancellation: state.echoCancellation })
      .pipe(
        Effect.flatMap((session) => watch(context, slot, session)),
        Effect.catch((error) => failSlot(context, slot, error)),
        Scope.provide(scope),
      );
    yield* Effect.forkIn(run, scope);
  });
}

function reconcile(context: ManagerContext) {
  const { state } = context;
  return Effect.gen(function* () {
    if (state.active && !state.paused) {
      if (!state.slot && !state.failure) yield* openSlot(context);
    } else {
      yield* closeCurrent(context);
    }
    yield* publish(context);
  });
}

function reopenIfOpen(context: ManagerContext) {
  return Effect.gen(function* () {
    if (!context.state.slot) return;
    yield* closeCurrent(context);
    yield* reconcile(context);
  });
}

function setActive(context: ManagerContext, next: boolean) {
  const { state } = context;
  return Effect.gen(function* () {
    if (state.active === next) return;
    state.active = next;
    if (!next) {
      state.paused = false;
      state.failure = '';
    }
    yield* reconcile(context);
  });
}

function pause(context: ManagerContext) {
  const { state } = context;
  return Effect.gen(function* () {
    if (!state.active || state.paused) return;
    state.paused = true;
    yield* reconcile(context);
  });
}

function resume(context: ManagerContext) {
  const { state } = context;
  return Effect.gen(function* () {
    if (!state.active) return;
    state.paused = false;
    state.failure = '';
    yield* reconcile(context);
  });
}

function ensure(context: ManagerContext) {
  const { state } = context;
  return Effect.gen(function* () {
    if (!state.active) return null;
    if (state.paused || state.failure) {
      state.paused = false;
      state.failure = '';
      yield* reconcile(context);
    }
    return state.slot;
  });
}

function setDeviceId(context: ManagerContext, next: string | undefined) {
  return Effect.gen(function* () {
    if (context.state.deviceId === next) return;
    context.state.deviceId = next;
    yield* reopenIfOpen(context);
  });
}

function setEchoCancellation(context: ManagerContext, next: boolean) {
  return Effect.gen(function* () {
    if (context.state.echoCancellation === next) return;
    context.state.echoCancellation = next;
    yield* reopenIfOpen(context);
  });
}

const INITIAL_STATE: ManagerState = {
  active: false,
  paused: false,
  deviceId: undefined,
  echoCancellation: false,
  slot: null,
  phase: 'opening',
  failure: '',
};

export class WarmMicrophone extends Context.Service<WarmMicrophone, WarmMicrophoneShape>()(
  'core/audio/WarmMicrophone',
) {
  static readonly layer = Layer.effect(
    WarmMicrophone,
    Effect.gen(function* () {
      const context: ManagerContext = {
        microphone: yield* Microphone,
        preference: yield* DevicePreference,
        layerScope: yield* Effect.scope,
        snapshot: yield* SubscriptionRef.make<MicrophoneSnapshot>({ status: 'off', error: '' }),
        state: { ...INITIAL_STATE },
      };
      yield* Effect.addFinalizer(() => closeCurrent(context));
      return {
        setActive: (next) => setActive(context, next),
        setDeviceId: (next) => setDeviceId(context, next),
        setEchoCancellation: (next) => setEchoCancellation(context, next),
        pause: pause(context),
        resume: resume(context),
        ensure: ensure(context),
        snapshot: context.snapshot,
      };
    }),
  );
}
