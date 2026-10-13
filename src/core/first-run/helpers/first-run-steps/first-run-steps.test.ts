import { describe, expect, it } from 'bun:test';
import { nextStep, previousStep, stepNumber, stepProgress } from './index';

describe('first run steps', () => {
  it('walks microphone, ai, voice and stops at both ends', () => {
    expect(previousStep('microphone')).toBeUndefined();
    expect(nextStep('microphone')).toBe('ai');
    expect(nextStep('ai')).toBe('voice');
    expect(previousStep('voice')).toBe('ai');
    expect(nextStep('voice')).toBeUndefined();
  });

  it('marks earlier steps done and later ones upcoming', () => {
    expect(stepProgress('ai').map(({ status }) => status)).toEqual(['done', 'current', 'upcoming']);
    expect(stepProgress('microphone')[0]).toMatchObject({ status: 'current' });
  });

  it('numbers steps from one', () => {
    expect(stepNumber('microphone')).toBe(1);
    expect(stepNumber('voice')).toBe(3);
  });
});
