export function buildAudioConstraints(
  deviceId?: string,
  echoCancellation = false,
): MediaStreamConstraints {
  const trimmed = typeof deviceId === 'string' ? deviceId.trim() : '';
  if (trimmed && trimmed !== 'default') {
    return {
      audio: {
        deviceId: { exact: trimmed },
        channelCount: { ideal: 1 },
        echoCancellation: echoCancellation ? { ideal: true } : false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
  }
  return {
    audio: {
      channelCount: { ideal: 1 },
      echoCancellation: echoCancellation ? { ideal: true } : false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
}
