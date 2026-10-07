// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { listeningLabel, micStatusLabel } from './composerVoice';

describe('composer voice labels', () => {
  it('tells the user how to cancel listening in both modes', () => {
    expect(listeningLabel('auto')).toBe('Listening… (Esc to cancel)');
    expect(listeningLabel('manual')).toContain('Esc to cancel');
    expect(listeningLabel(undefined)).toContain('Esc to cancel');
  });

  it('describes the microphone state and stays quiet when unmanaged', () => {
    expect(micStatusLabel('paused')).toBe('Microphone paused');
    expect(micStatusLabel('warming')).toBe('Microphone warming up…');
    expect(micStatusLabel('unmanaged')).toBe('');
    expect(micStatusLabel('off')).toBe('');
  });
});
