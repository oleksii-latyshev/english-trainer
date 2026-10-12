import { Effect, Layer, ManagedRuntime } from 'effect';
import { Atom } from 'effect/reactivity';
import { AudioInputsService } from '../services/audio-inputs-service';
import { DevicePreference } from '../services/device-preference-service';
import { Microphone } from '../services/microphone-service';
import { WarmMicrophone } from '../services/warm-microphone-service';
import { readPreferredMicrophone } from './preferred-microphone';

const DevicePreferenceLive = Layer.succeed(DevicePreference, {
  current: Effect.sync(readPreferredMicrophone),
});

export const AudioLive = WarmMicrophone.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(Microphone.layer, DevicePreferenceLive)),
  Layer.provideMerge(AudioInputsService.layer),
);

const memoMap = Layer.makeMemoMapUnsafe();

export type AudioServices = Layer.Success<typeof AudioLive>;

export const audioRuntime = ManagedRuntime.make(AudioLive, { memoMap });

export const audioAtomRuntime = Atom.context({ memoMap })(AudioLive);
