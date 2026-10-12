import { describe, expect, test } from 'bun:test';
import { INITIAL_SYNTHESIS_ESTIMATE } from '../speech-timing';
import { observeSynthesis, pauseBeforeMs, renderDelayMs, synthesisGuardMs } from './index';

describe('synthesisGuardMs', () => {
  test('the first phrase keeps the 800 ms interactive guard', () => {
    expect(synthesisGuardMs(null)).toBe(800);
  });

  test('a later phrase may take as long as the audio already queued plus a margin', () => {
    expect(synthesisGuardMs(3000)).toBe(3400);
  });

  test('a later phrase is never guarded tighter than the first', () => {
    expect(synthesisGuardMs(0)).toBe(800);
  });
});

describe('renderDelayMs', () => {
  test('renders immediately while little audio is queued', () => {
    expect(renderDelayMs(2000)).toBe(0);
  });

  test('waits until the queued audio drops below the lookahead target', () => {
    expect(renderDelayMs(9000)).toBe(3000);
  });
});

describe('pauseBeforeMs', () => {
  test('continues a sentence without a pause', () => {
    expect(pauseBeforeMs('That sounds like a useful approach,')).toBe(0);
  });

  test('pauses briefly after a finished sentence', () => {
    expect(pauseBeforeMs('That sounds useful.')).toBe(150);
    expect(pauseBeforeMs('Really?!')).toBe(150);
    expect(pauseBeforeMs('He said "stop."')).toBe(150);
  });

  test('has no pause before the first phrase', () => {
    expect(pauseBeforeMs(null)).toBe(0);
  });
});

describe('observeSynthesis', () => {
  test('moves the per-character cost toward what was observed', () => {
    const slower = observeSynthesis(INITIAL_SYNTHESIS_ESTIMATE, 50, 1250);

    expect(slower.perCharMs).toBeGreaterThan(INITIAL_SYNTHESIS_ESTIMATE.perCharMs);
    expect(slower.fixedMs).toBe(INITIAL_SYNTHESIS_ESTIMATE.fixedMs);
  });

  test('keeps the estimate inside its bounds', () => {
    expect(observeSynthesis(INITIAL_SYNTHESIS_ESTIMATE, 10, 100000).perCharMs).toBe(40);
    expect(observeSynthesis(INITIAL_SYNTHESIS_ESTIMATE, 10, 0).perCharMs).toBeGreaterThanOrEqual(4);
  });

  test('ignores an empty phrase', () => {
    expect(observeSynthesis(INITIAL_SYNTHESIS_ESTIMATE, 0, 500)).toBe(INITIAL_SYNTHESIS_ESTIMATE);
  });
});
