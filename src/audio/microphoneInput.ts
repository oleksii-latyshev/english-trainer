import type { ActualAudioInput } from './types';

export function actualEchoCancellationEnabled(
  settings: Pick<MediaTrackSettings, 'echoCancellation'> | undefined,
): boolean {
  return settings?.echoCancellation === true;
}

export function describeInput(stream: MediaStream): ActualAudioInput {
  const [track] = stream.getAudioTracks();
  const settings = typeof track?.getSettings === 'function' ? track.getSettings() : {};
  return {
    deviceId: typeof settings.deviceId === 'string' ? settings.deviceId : '',
    label: track?.label ? track.label : 'Microphone',
    echoCancellation:
      typeof settings.echoCancellation === 'boolean' ? settings.echoCancellation : undefined,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  };
}
