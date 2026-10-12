import { Context, type Effect } from 'effect';

type DevicePreferenceShape = {
  readonly current: Effect.Effect<string>;
};

export class DevicePreference extends Context.Service<DevicePreference, DevicePreferenceShape>()(
  'core/audio/DevicePreference',
) {}
