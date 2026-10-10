export function buildAudioConstraints(
  deviceId?: string,
  echoCancellation = false,
): MediaStreamConstraints {
  // Noise suppression and gain remain off; voice interruption may opt into echo cancellation.
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
