import { describe, expect, it } from 'bun:test';
import { turnTiming } from './turnTiming';

describe('conversation timing', () => {
  it('separates AI request and voice startup from manual time since Stop', () => {
    expect(
      turnTiming({
        speechStoppedAtMs: 100,
        sentAtMs: 1200,
        replyAtMs: 3200,
        audioAtMs: 3500,
        voiceStartMs: 280,
        providerLatencyMs: 1750,
      }),
    ).toEqual({
      agyMs: 1750,
      aiRequestMs: 2000,
      aiVoiceStartMs: 280,
      sendToAudioMs: 2300,
      stopToAudioMs: 3400,
    });
  });

  it('leaves audio timing unavailable until speech actually starts', () => {
    expect(turnTiming({ sentAtMs: 10, replyAtMs: 45 })).toEqual({
      agyMs: undefined,
      aiRequestMs: 35,
    });
  });
});
