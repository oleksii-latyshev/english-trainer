import { describe, expect, it } from 'bun:test';
import { practiceBlockedReason, practiceSummary } from './index';

const READY = {
  isLibraryError: false,
  isLibraryReady: true,
  isSessionOpen: false,
  isAudioBusy: false,
  practicableCount: 2,
};

describe('why mistake practice is blocked', () => {
  it('is not blocked when Memory is ready and the microphone is free', () => {
    expect(practiceBlockedReason(READY)).toBe('');
  });

  it('names the first thing in the way', () => {
    expect(practiceBlockedReason({ ...READY, isLibraryError: true })).toContain('Reload Memory');
    expect(practiceBlockedReason({ ...READY, isLibraryReady: false })).toContain('still loading');
    expect(practiceBlockedReason({ ...READY, isSessionOpen: true })).toContain(
      'current conversation',
    );
    expect(practiceBlockedReason({ ...READY, isAudioBusy: true })).toContain('microphone');
    expect(practiceBlockedReason({ ...READY, practicableCount: 0 })).toContain('at least twice');
  });
});

describe('what the practice is built on', () => {
  it('names two mistakes and counts the rest', () => {
    expect(practiceSummary(['the most part of', 'Just I want'], 5)).toBe(
      '5 short spoken questions built on “the most part of”, “Just I want” and 3 more.',
    );
  });

  it('lists every mistake when there are no more', () => {
    expect(practiceSummary(['the most part of', 'Just I want'], 2)).toBe(
      '5 short spoken questions built on “the most part of” and “Just I want”.',
    );
    expect(practiceSummary(['in the university'], 1)).toBe(
      '5 short spoken questions built on “in the university”.',
    );
  });

  it('only states the length when there is nothing to build on', () => {
    expect(practiceSummary([], 0)).toBe('5 short spoken questions');
  });
});
