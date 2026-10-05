// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { formatAudioDeviceList, hasEmptyDeviceLabels } from './deviceUtils';

function createMockDevice(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return {
    deviceId,
    kind,
    label,
    groupId: 'group-1',
    toJSON: () => ({}),
  };
}

describe('deviceUtils', () => {
  describe('formatAudioDeviceList', () => {
    it('filters out non-audioinput devices', () => {
      const devices: MediaDeviceInfo[] = [
        createMockDevice('audioinput', 'mic-1', 'Internal Mic'),
        createMockDevice('videoinput', 'cam-1', 'FaceTime Camera'),
        createMockDevice('audiooutput', 'speaker-1', 'Headphones'),
      ];

      const result = formatAudioDeviceList(devices);
      expect(result).toEqual([{ deviceId: 'mic-1', label: 'Internal Mic' }]);
    });

    it('filters out "default" deviceId to avoid duplicate default options', () => {
      const devices: MediaDeviceInfo[] = [
        createMockDevice('audioinput', 'default', 'Default Audio Device'),
        createMockDevice('audioinput', 'mic-1', 'MacBook Pro Microphone'),
      ];

      const result = formatAudioDeviceList(devices);
      expect(result).toEqual([{ deviceId: 'mic-1', label: 'MacBook Pro Microphone' }]);
    });

    it('assigns sequential neutral labels when device labels are empty', () => {
      const devices: MediaDeviceInfo[] = [
        createMockDevice('audioinput', 'mic-a', ''),
        createMockDevice('audioinput', 'mic-b', '   '),
        createMockDevice('audioinput', 'mic-c', 'Studio USB Mic'),
      ];

      const result = formatAudioDeviceList(devices);
      expect(result).toEqual([
        { deviceId: 'mic-a', label: 'Microphone 1' },
        { deviceId: 'mic-b', label: 'Microphone 2' },
        { deviceId: 'mic-c', label: 'Studio USB Mic' },
      ]);
    });
  });

  describe('hasEmptyDeviceLabels', () => {
    it('returns true when any audioinput device has an empty label', () => {
      const devices: MediaDeviceInfo[] = [
        createMockDevice('audioinput', 'mic-1', ''),
        createMockDevice('audioinput', 'mic-2', 'External Mic'),
      ];
      expect(hasEmptyDeviceLabels(devices)).toBe(true);
    });

    it('returns false when all audioinput devices have labels', () => {
      const devices: MediaDeviceInfo[] = [
        createMockDevice('audioinput', 'mic-1', 'MacBook Mic'),
        createMockDevice('audioinput', 'mic-2', 'External Mic'),
      ];
      expect(hasEmptyDeviceLabels(devices)).toBe(false);
    });

    it('ignores empty labels on video or output devices', () => {
      const devices: MediaDeviceInfo[] = [
        createMockDevice('audioinput', 'mic-1', 'MacBook Mic'),
        createMockDevice('videoinput', 'cam-1', ''),
        createMockDevice('audiooutput', 'speaker-1', ''),
      ];
      expect(hasEmptyDeviceLabels(devices)).toBe(false);
    });
  });
});
