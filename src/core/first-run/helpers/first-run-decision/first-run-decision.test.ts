import { describe, expect, it } from 'bun:test';
import { decideFirstRun, type UseEvidence } from './index';

const NO_EVIDENCE: UseEvidence = {
  hasSession: false,
  hasGeminiKey: false,
  hasMemory: false,
  hasVoiceChoice: false,
  hasMicrophoneChoice: false,
};

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
