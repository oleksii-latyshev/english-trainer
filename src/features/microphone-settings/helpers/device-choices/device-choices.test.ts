import { describe, expect, it } from 'bun:test';
import {
  choiceOfDevice,
  deviceChoices,
  deviceDescription,
  deviceOfChoice,
  SYSTEM_DEFAULT_CHOICE,
} from '.';

const OPTIONS = [
  { deviceId: 'usb-id', label: 'USB microphone' },
  { deviceId: 'built-in', label: 'MacBook Pro Microphone' },
];

describe('deviceChoices', () => {
  it('starts with the system default and lists every input', () => {
    const choices = deviceChoices(OPTIONS, '');
    expect(choices.map((choice) => choice.label)).toEqual([
      'System default',
      'USB microphone',
      'MacBook Pro Microphone',
    ]);
  });

  it('keeps a remembered device that is no longer connected selectable', () => {
    const choices = deviceChoices(OPTIONS, 'unplugged-device-id');
    expect(choices[choices.length - 1]).toEqual({
      value: 'unplugged-device-id',
      label: 'Disconnected device (unplugge…)',
    });
  });

  it('does not add a disconnected entry for a connected device', () => {
    expect(deviceChoices(OPTIONS, 'usb-id')).toHaveLength(3);
  });
});

describe('choice mapping', () => {
  it('maps the system default to the empty device id and back', () => {
    expect(choiceOfDevice('')).toBe(SYSTEM_DEFAULT_CHOICE);
    expect(deviceOfChoice(SYSTEM_DEFAULT_CHOICE)).toBe('');
    expect(deviceOfChoice(choiceOfDevice('usb-id'))).toBe('usb-id');
  });
});

describe('deviceDescription', () => {
  it('is empty when there is nothing to say', () => {
    expect(deviceDescription({ hasUnnamed: false, lastInputLabel: undefined })).toBeUndefined();
  });

  it('explains hidden names and names the last input', () => {
    expect(deviceDescription({ hasUnnamed: true, lastInputLabel: 'USB microphone' })).toBe(
      'Microphone names are hidden by macOS until you record once; then they appear. Last recorded with: USB microphone.',
    );
  });

  it('falls back to Default input for an unlabeled device', () => {
    expect(deviceDescription({ hasUnnamed: false, lastInputLabel: '' })).toBe(
      'Last recorded with: Default input.',
    );
  });
});
