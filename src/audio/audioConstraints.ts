export function buildAudioConstraints(deviceId?: string): MediaStreamConstraints {
  // Avoid browser voice filtering; playback stops before push-to-talk capture.
  const trimmed = typeof deviceId === 'string' ? deviceId.trim() : '';
  if (trimmed && trimmed !== 'default') {
    return {
      audio: {
        deviceId: { exact: trimmed },
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
  }
  return {
    audio: {
      channelCount: { ideal: 1 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
}
