// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { checkStatus, HEARD_SPEECH_LEVEL, isHearingSpeech } from './heardSpeech';

describe('hearing speech', () => {
  it('needs a real level, not silence or garbage', () => {
    expect(isHearingSpeech(undefined)).toBe(false);
    expect(isHearingSpeech(Number.NaN)).toBe(false);
    expect(isHearingSpeech(0.2)).toBe(false);
    expect(isHearingSpeech(HEARD_SPEECH_LEVEL)).toBe(true);
    expect(isHearingSpeech(0.9)).toBe(true);
  });
});

describe('check status', () => {
  it('says we can hear you once speech was heard, whatever the state', () => {
    expect(checkStatus('recording', true)).toEqual({ ok: true, text: 'We can hear you' });
    expect(checkStatus('recorded', true).ok).toBe(true);
  });

  it('tells the learner what to do when nothing was heard', () => {
    expect(checkStatus('requesting', false).text).toContain('Getting ready');
    expect(checkStatus('recording', false).text).toContain('Listening');
    expect(checkStatus('recorded', false).text).toContain('did not hear');
    expect(checkStatus('idle', false).text).toContain('Check again');
  });
});
