import { describe, expect, it } from 'bun:test';
import { resultEvaMood, reviewEvaMood, reviewMicCopy, reviewPhase } from './index';

describe('review phase', () => {
  const idle = { capture: 'idle', isTranscribing: false, isSaving: false } as const;

  it('follows the recording, the transcription and the save in that order of priority', () => {
    expect(reviewPhase(idle)).toBe('prompt');
    expect(reviewPhase({ ...idle, capture: 'requesting' })).toBe('starting');
    expect(reviewPhase({ ...idle, capture: 'recording' })).toBe('listening');
    expect(reviewPhase({ ...idle, capture: 'stopping' })).toBe('transcribing');
    expect(reviewPhase({ ...idle, capture: 'idle', isTranscribing: true })).toBe('transcribing');
    expect(reviewPhase({ ...idle, capture: 'idle', isSaving: true })).toBe('saving');
    expect(reviewPhase({ ...idle, isTranscribing: false })).toBe('prompt');
  });

  it('lets the mic press only when an answer can start or finish', () => {
    expect(reviewMicCopy('prompt', false).isPressable).toBe(true);
    expect(reviewMicCopy('listening', false)).toMatchObject({ icon: 'stop', variant: 'live' });
    for (const phase of ['starting', 'transcribing', 'saving'] as const) {
      expect(reviewMicCopy(phase, false).isPressable).toBe(false);
    }
  });

  it('tells the learner about Esc only while Eva speaks or the mic listens', () => {
    expect(reviewMicCopy('prompt', true).hint).toContain('Esc');
    expect(reviewMicCopy('prompt', false).hint).not.toContain('Esc');
    expect(reviewMicCopy('listening', false).hint).toContain('Esc');
  });

  it('says a practice try is not scored', () => {
    expect(reviewMicCopy('prompt', false, true).title).toBe('Practice try — not scored');
    expect(reviewMicCopy('prompt', false).title).toBe('Your answer');
    expect(reviewMicCopy('prompt', true, true).title).toBe('Eva is reading the situation');
  });

  it('moves Eva with the phase and the result', () => {
    expect(reviewEvaMood('prompt', true)).toBe('speaking');
    expect(reviewEvaMood('prompt', false)).toBe('idle');
    expect(reviewEvaMood('listening', false)).toBe('listening');
    expect(reviewEvaMood('saving', false)).toBe('processing');
    expect(resultEvaMood(true)).toBe('happy');
    expect(resultEvaMood(false)).toBe('encouraging');
  });
});
