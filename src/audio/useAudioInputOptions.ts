import { useCallback, useEffect, useRef, useState } from 'react';
import { formatAudioDeviceList, hasEmptyDeviceLabels } from './deviceUtils';
import type { AudioInputOption } from './types';

export function useAudioInputOptions() {
  const generation = useRef(0);
  const [deviceOptions, setDeviceOptions] = useState<AudioInputOption[]>([]);
  const [hasUnnamed, setHasUnnamed] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    const request = ++generation.current;
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setDeviceOptions([]);
        return;
      }
      const rawDevices = await navigator.mediaDevices.enumerateDevices();
      if (request !== generation.current) return;
      setDeviceOptions(formatAudioDeviceList(rawDevices));
      setHasUnnamed(hasEmptyDeviceLabels(rawDevices));
      setDeviceError(null);
    } catch {
      if (request !== generation.current) return;
      setDeviceError('Unable to list audio input devices.');
    }
  }, []);

  useEffect(() => {
    void loadDevices();
    const mediaDevices = navigator.mediaDevices;
    if (mediaDevices?.addEventListener) {
      const handleDeviceChange = () => {
        void loadDevices();
      };
      mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        generation.current += 1;
        mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
    return () => {
      generation.current += 1;
    };
  }, [loadDevices]);

  return { deviceOptions, hasUnnamed, deviceError, loadDevices };
}
