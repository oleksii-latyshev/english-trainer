import { describe, expect, it } from 'bun:test';
import { Effect, SubscriptionRef } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { microphoneSnapshotAtom } from '../model/atoms';
import { audioRuntime } from '../model/runtime';
import { WarmMicrophone } from '../services/warm-microphone-service';

describe('audio runtime', () => {
  it('shares one warm microphone between atoms and imperative callers', async () => {
    const registry = AtomRegistry.make();
    const unmount = registry.mount(microphoneSnapshotAtom);
    await audioRuntime.runPromise(
      Effect.gen(function* () {
        const warm = yield* WarmMicrophone;
        yield* SubscriptionRef.set(warm.snapshot, { status: 'paused' as const, error: '' });
      }),
    );
    await Effect.runPromise(Effect.sleep(20));
    const result = registry.get(microphoneSnapshotAtom);
    expect(AsyncResult.isSuccess(result) && result.value.status).toBe('paused');
    unmount();
  });
});
