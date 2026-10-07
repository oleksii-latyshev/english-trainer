import type { Ref } from 'react';
import type { AudioInputOption } from '@/audio/types';

/** The input-device dropdown shared by Settings and first run. */
export function MicrophoneDeviceSelect({
  id,
  className,
  options,
  selectedDeviceId,
  onSelect,
  disabled,
  selectRef,
}: {
  id: string;
  className: string;
  options: AudioInputOption[];
  selectedDeviceId: string;
  onSelect: (deviceId: string) => void;
  disabled: boolean;
  selectRef?: Ref<HTMLSelectElement>;
}) {
  const isDisconnected =
    selectedDeviceId !== '' && !options.some((device) => device.deviceId === selectedDeviceId);
  return (
    <select
      className={className}
      disabled={disabled}
      id={id}
      onChange={(event) => {
        const value = event.target.value;
        onSelect(value);
      }}
      ref={selectRef}
      value={selectedDeviceId}
    >
      <option value="">System default</option>
      {options.map((device) => (
        <option key={device.deviceId} value={device.deviceId}>
          {device.label}
        </option>
      ))}
      {isDisconnected && (
        <option value={selectedDeviceId}>
          Disconnected device ({selectedDeviceId.slice(0, 8)}…)
        </option>
      )}
    </select>
  );
}
