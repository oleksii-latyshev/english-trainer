// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  decideFirstRun,
  nextStep,
  parseFirstRunMarker,
  previousStep,
  stepIndicators,
  type UseEvidence,
} from './firstRun';

const NO_EVIDENCE: UseEvidence = {
  hasSession: false,
  hasGeminiKey: false,
  hasMemory: false,
  hasVoiceChoice: false,
  hasMicrophoneChoice: false,
};

describe('first run marker', () => {
  it('is pending unless a known status was stored', () => {
    for (const value of [undefined, null, 'finished', [], {}, { status: 'done' }]) {
      expect(parseFirstRunMarker(value)).toEqual({ status: 'pending' });
    }
    expect(parseFirstRunMarker({ status: 'skipped' })).toEqual({ status: 'skipped' });
    expect(parseFirstRunMarker({ status: 'finished', extra: 1 })).toEqual({ status: 'finished' });
  });
});

describe('first run decision', () => {
  it('shows on a clean first launch', () => {
    expect(decideFirstRun('pending', NO_EVIDENCE)).toBe('show');
  });

  it('never shows again after finish, skip or an earlier existing-user verdict', () => {
    for (const status of ['finished', 'skipped', 'existing'] as const) {
      expect(decideFirstRun(status, NO_EVIDENCE)).toBe('already-handled');
    }
  });

  it('treats any sign of earlier use as an existing user', () => {
    for (const key of Object.keys(NO_EVIDENCE) as (keyof UseEvidence)[]) {
      expect(decideFirstRun('pending', { ...NO_EVIDENCE, [key]: true })).toBe('existing-user');
    }
  });
});

describe('first run steps', () => {
  it('walks microphone, ai, voice and stops at both ends', () => {
    expect(previousStep('microphone')).toBeUndefined();
    expect(nextStep('microphone')).toBe('ai');
    expect(nextStep('ai')).toBe('voice');
    expect(previousStep('voice')).toBe('ai');
    expect(nextStep('voice')).toBeUndefined();
  });

  it('marks earlier steps done with a check and later ones upcoming', () => {
    expect(stepIndicators('ai').map(({ badge, status }) => [badge, status])).toEqual([
      ['✓', 'done'],
      ['2', 'current'],
      ['3', 'upcoming'],
    ]);
    expect(stepIndicators('microphone')[0]).toMatchObject({ badge: '1', status: 'current' });
  });
});
