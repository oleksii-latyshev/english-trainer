// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  resultEvaMood,
  reviewEvaMood,
  reviewMicCopy,
  reviewPhase,
  reviewPrompt,
} from './reviewTurn';

describe('review phase', () => {
  const idle = { captureStatus: 'idle', isTranscribing: false, isSaving: false } as const;

  it('follows the recording, the transcription and the save in that order of priority', () => {
    expect(reviewPhase(idle)).toBe('prompt');
    expect(reviewPhase({ ...idle, captureStatus: 'requesting' })).toBe('starting');
    expect(reviewPhase({ ...idle, captureStatus: 'recording' })).toBe('listening');
    expect(reviewPhase({ ...idle, captureStatus: 'stopping' })).toBe('transcribing');
    expect(reviewPhase({ ...idle, captureStatus: 'ready', isTranscribing: true })).toBe(
      'transcribing',
    );
    expect(reviewPhase({ ...idle, captureStatus: 'ready', isSaving: true })).toBe('saving');
    // A failed recording leaves the learner at the prompt, with the problem shown beside it.
    expect(reviewPhase({ ...idle, captureStatus: 'error' })).toBe('prompt');
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

describe('review prompt', () => {
  it('gives a phrase cue as a situation', () => {
    expect(reviewPrompt('phrase', 'A friend asks about your move.')).toEqual({
      label: 'Eva · situation',
      text: 'A friend asks about your move.',
      spoken: 'Here is a situation. A friend asks about your move.',
    });
  });

  it('asks for a mistake to be said better instead of reading it as a model', () => {
    const prompt = reviewPrompt('mistake', 'I work in there yesterday.');
    expect(prompt.label).toBe('Eva · say it better');
    expect(prompt.spoken).toBe('Say this one better. I work in there yesterday.');
  });

  it('introduces generated situations as context even for a mistake item', () => {
    const prompt = reviewPrompt('mistake', 'A coworker asks what happened.', true);
    expect(prompt.label).toBe('Eva · situation');
    expect(prompt.spoken).toBe('Here is a situation. A coworker asks what happened.');
  });
});
