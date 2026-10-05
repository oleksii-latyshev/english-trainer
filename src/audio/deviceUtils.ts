import type { AudioInputOption } from './types';

export function formatAudioDeviceList(
  devices: Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>[],
): AudioInputOption[] {
  const audioInputs = devices.filter((device) => device.kind === 'audioinput');
  let unnamedIndex = 0;

  return audioInputs
    .filter((device) => device.deviceId !== 'default')
    .map((device) => {
      const trimmedLabel = device.label.trim();
      if (trimmedLabel) {
        return {
          deviceId: device.deviceId,
          label: trimmedLabel,
        };
      }
      unnamedIndex += 1;
      return {
        deviceId: device.deviceId,
        label: `Microphone ${unnamedIndex}`,
      };
    });
}

export function hasEmptyDeviceLabels(
  devices: Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>[],
): boolean {
  const audioInputs = devices.filter((device) => device.kind === 'audioinput');
  return audioInputs.some((device) => !device.label.trim());
}
