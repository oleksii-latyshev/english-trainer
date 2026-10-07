import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getPreferredDeviceId, subscribeDevicePreference } from './devicePreference';
import { createMicrophoneManager, type MicrophoneStatus } from './microphoneManager';
import type { MicrophoneSession } from './microphoneSession';

export type MicrophoneController = {
  status: MicrophoneStatus;
  error: string;
  setActive: (active: boolean) => void;
  pause: () => void;
  resume: () => void;
  ensure: () => MicrophoneSession | null;
};

/** The practice microphone: warm while a session is active, released on pause or when it ends. */
export function useMicrophoneSession(): MicrophoneController {
  const [manager] = useState(createMicrophoneManager);
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const deviceId = useSyncExternalStore(subscribeDevicePreference, getPreferredDeviceId, () => '');

  useEffect(() => {
    manager.setDeviceId(deviceId);
  }, [manager, deviceId]);

  useEffect(() => () => manager.setActive(false), [manager]);

  return useMemo(
    () => ({
      status: snapshot.status,
      error: snapshot.error,
      setActive: manager.setActive,
      pause: manager.pause,
      resume: manager.resume,
      ensure: manager.ensure,
    }),
    [manager, snapshot],
  );
}
