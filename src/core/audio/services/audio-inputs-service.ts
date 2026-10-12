import { Context, Data, Effect, Layer, Stream } from 'effect';
import type { AudioInputOption } from '../audio';
import { formatAudioDeviceList, hasEmptyDeviceLabels } from '../helpers/device-utils';

export type AudioInputs = {
  readonly options: AudioInputOption[];
  readonly hasUnnamed: boolean;
};

export class AudioInputsUnavailable extends Data.TaggedError('AudioInputsUnavailable')<{
  readonly message: string;
}> {}

type AudioInputsShape = {
  readonly list: Effect.Effect<AudioInputs, AudioInputsUnavailable>;
  readonly changes: Stream.Stream<void>;
};

const NO_INPUTS: AudioInputs = { options: [], hasUnnamed: false };

const list = Effect.suspend(() => {
  const devices = navigator.mediaDevices;
  if (!devices?.enumerateDevices) return Effect.succeed(NO_INPUTS);
  return Effect.tryPromise({
    try: () => devices.enumerateDevices(),
    catch: () => new AudioInputsUnavailable({ message: 'Unable to list audio input devices.' }),
  }).pipe(
    Effect.map((raw) => ({
      options: formatAudioDeviceList(raw),
      hasUnnamed: hasEmptyDeviceLabels(raw),
    })),
  );
});

const changes: Stream.Stream<void> = Stream.suspend(() => {
  const devices = navigator.mediaDevices;
  if (!devices?.addEventListener) return Stream.empty;
  return Stream.fromEventListener(devices, 'devicechange').pipe(Stream.map(() => undefined));
});

export class AudioInputsService extends Context.Service<AudioInputsService, AudioInputsShape>()(
  'core/audio/AudioInputsService',
) {
  static readonly layer = Layer.succeed(AudioInputsService, { list, changes });
}
