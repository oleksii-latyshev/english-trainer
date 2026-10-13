import type { AudioInputOption } from '@/core/audio';

export const SYSTEM_DEFAULT_CHOICE = 'system-default-input';
const SYSTEM_DEFAULT_LABEL = 'System default';
const SHORT_ID_LENGTH = 8;

export type DeviceChoice = { readonly value: string; readonly label: string };

export function choiceOfDevice(deviceId: string): string {
  return deviceId === '' ? SYSTEM_DEFAULT_CHOICE : deviceId;
}

export function deviceOfChoice(choice: string): string {
  return choice === SYSTEM_DEFAULT_CHOICE ? '' : choice;
}

export function deviceChoices(
  options: readonly AudioInputOption[],
  selectedDeviceId: string,
): DeviceChoice[] {
  const choices: DeviceChoice[] = [
    { value: SYSTEM_DEFAULT_CHOICE, label: SYSTEM_DEFAULT_LABEL },
    ...options.map((option) => ({ value: option.deviceId, label: option.label })),
  ];
  const isDisconnected =
    selectedDeviceId !== '' && !options.some((option) => option.deviceId === selectedDeviceId);
  if (isDisconnected) {
    choices.push({
      value: selectedDeviceId,
      label: `Disconnected device (${selectedDeviceId.slice(0, SHORT_ID_LENGTH)}…)`,
    });
  }
  return choices;
}

export function deviceDescription(options: {
  readonly hasUnnamed: boolean;
  readonly lastInputLabel: string | undefined;
}): string | undefined {
  const lines = [
    options.hasUnnamed
      ? 'Microphone names are hidden by macOS until you record once; then they appear.'
      : undefined,
    options.lastInputLabel === undefined
      ? undefined
      : `Last recorded with: ${options.lastInputLabel || 'Default input'}.`,
  ].filter((line) => line !== undefined);
  return lines.length > 0 ? lines.join(' ') : undefined;
}
