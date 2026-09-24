export type TurnTiming = {
  agyMs?: number;
  aiRequestMs: number;
  aiVoiceStartMs?: number;
  sendToAudioMs?: number;
  stopToAudioMs?: number;
};

type Timestamps = {
  sentAtMs: number;
  replyAtMs: number;
  audioAtMs?: number;
  voiceStartMs?: number;
  speechStoppedAtMs?: number;
  providerLatencyMs?: number;
};

export function turnTiming({
  sentAtMs,
  replyAtMs,
  audioAtMs,
  voiceStartMs,
  speechStoppedAtMs,
  providerLatencyMs,
}: Timestamps): TurnTiming {
  const aiRequestMs = Math.max(0, replyAtMs - sentAtMs);
  const agyMs = providerLatencyMs;
  if (audioAtMs === undefined || voiceStartMs === undefined) return { agyMs, aiRequestMs };
  return {
    agyMs,
    aiRequestMs,
    aiVoiceStartMs: Math.max(0, voiceStartMs),
    sendToAudioMs: Math.max(0, audioAtMs - sentAtMs),
    stopToAudioMs:
      speechStoppedAtMs === undefined ? undefined : Math.max(0, audioAtMs - speechStoppedAtMs),
  };
}
