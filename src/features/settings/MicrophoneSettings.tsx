import { Card } from '@heroui/react';
import type { ChangeEvent } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import { useAudioInputOptions } from '@/audio/useAudioInputOptions';
import { useMicrophoneTest } from '@/audio/useMicrophoneTest';
import { useTrainer } from '@/context/TrainerContext';
import { MicrophoneTestControls } from './MicrophoneTestControls';

export function MicrophoneSettings() {
  const { capture, speech } = useTrainer();
  const practiceCapturing = !capture.canChangeSession;
  const { selectedDeviceId, selectDevice, storageStatus, actualInput } = usePreferredMicrophone();
  const { deviceOptions, hasUnnamed, deviceError, loadDevices } = useAudioInputOptions();
  const test = useMicrophoneTest(selectedDeviceId, () => {
    void loadDevices();
  });

  const handleDeviceSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    selectDevice(value);
  };

  const isDisconnectedDevice =
    selectedDeviceId !== '' &&
    !deviceOptions.some((device) => device.deviceId === selectedDeviceId);

  const activeActualInput =
    test.state.tag === 'recording' || test.state.tag === 'stopping' || test.state.tag === 'recorded'
      ? test.state.actualInput
      : actualInput;

  return (
    <Card className="border border-white/[0.08] bg-[#161619] p-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Microphone</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Choose an audio input and run a quick 10-second test before starting practice.
        </p>
      </div>

      {practiceCapturing && (
        <p className="mt-3 text-xs text-amber-300" role="status">
          Finish the active practice recording before testing or changing the microphone.
        </p>
      )}

      {!storageStatus.available && (
        <div
          className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200"
          role="status"
        >
          {storageStatus.warning ||
            'Local storage is unavailable; device selection will only apply to the current session.'}
        </div>
      )}

      {deviceError && (
        <p className="mt-4 text-xs text-rose-300" role="alert">
          {deviceError}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-xs text-zinc-300" htmlFor="microphone-select">
          Input device
          <select
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
            disabled={test.isCapturing || practiceCapturing}
            id="microphone-select"
            onChange={handleDeviceSelect}
            value={selectedDeviceId}
          >
            <option value="">System default</option>
            {deviceOptions.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
            {isDisconnectedDevice && (
              <option value={selectedDeviceId}>
                Disconnected device ({selectedDeviceId.slice(0, 8)}…)
              </option>
            )}
          </select>
        </label>

        {hasUnnamed && (
          <p className="text-xs text-zinc-400">
            Microphone names are hidden by macOS until permission is granted. Once you record,
            device names will appear.
          </p>
        )}

        {activeActualInput && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs text-zinc-300">
            <span>Last recorded input:</span>
            <span className="font-medium text-emerald-300">
              {activeActualInput.label || 'Default input'}
            </span>
          </div>
        )}

        <MicrophoneTestControls
          test={test}
          disabled={practiceCapturing}
          onStart={() => {
            speech.stop();
            void test.startTest();
          }}
          onRefresh={() => void loadDevices()}
        />
      </div>
    </Card>
  );
}
