// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { createNoiseFloorTracker, createTurnDetector } from './turnDetector';

const FRAME_MS = 20;
const SPEECH = 0.08;
const QUIET = 0.002;

function feed(
  detector: ReturnType<typeof createTurnDetector>,
  rms: number,
  durationMs: number,
): { started: number; ended: number } {
  let started = 0;
  let ended = 0;
  for (let t = 0; t < durationMs; t += FRAME_MS) {
    const result = detector.push(rms, FRAME_MS);
    if (result.speechStarted) started += 1;
    if (result.turnEnded) ended += 1;
  }
  return { started, ended };
}

describe('turn detector', () => {
  it('ends the turn after the pause that follows speech', () => {
    const detector = createTurnDetector({ endPauseMs: 1500 });
    expect(feed(detector, QUIET, 500)).toEqual({ started: 0, ended: 0 });
    expect(feed(detector, SPEECH, 1000)).toEqual({ started: 1, ended: 0 });
    expect(feed(detector, QUIET, 1400).ended).toBe(0);
    expect(feed(detector, QUIET, 200).ended).toBe(1);
    expect(feed(detector, QUIET, 2000).ended).toBe(0);
  });

  it('restarts the pause when speech resumes', () => {
    const detector = createTurnDetector({ endPauseMs: 1000 });
    feed(detector, SPEECH, 600);
    feed(detector, QUIET, 800);
    feed(detector, SPEECH, 200);
    expect(feed(detector, QUIET, 800).ended).toBe(0);
    expect(feed(detector, QUIET, 400).ended).toBe(1);
  });

  it('does not treat a short click as a turn', () => {
    const detector = createTurnDetector({ endPauseMs: 1000 });
    expect(feed(detector, SPEECH, 100).started).toBe(0);
    expect(feed(detector, QUIET, 3000)).toEqual({ started: 0, ended: 0 });
    expect(detector.hasSpeech()).toBe(false);
  });

  it('keeps the turn open while held and restarts the pause on release', () => {
    const detector = createTurnDetector({ endPauseMs: 1000 });
    feed(detector, SPEECH, 600);
    detector.setHold(true);
    expect(feed(detector, QUIET, 5000).ended).toBe(0);
    detector.setHold(false);
    expect(feed(detector, QUIET, 800).ended).toBe(0);
    expect(feed(detector, QUIET, 400).ended).toBe(1);
  });

  it('adapts to a louder room instead of hearing it as speech forever', () => {
    const ambient = 0.02;
    const tracker = createNoiseFloorTracker();
    const initialThreshold = tracker.threshold();
    expect(ambient).toBeGreaterThan(initialThreshold);
    for (let t = 0; t < 90_000; t += FRAME_MS) tracker.update(ambient, FRAME_MS);
    expect(tracker.value()).toBeGreaterThan(ambient * 0.9);
    expect(tracker.threshold()).toBeGreaterThan(ambient);
  });

  it('does not let a long answer lift the floor above the voice', () => {
    const tracker = createNoiseFloorTracker(QUIET);
    for (let t = 0; t < 5000; t += FRAME_MS) tracker.update(SPEECH, FRAME_MS);
    expect(tracker.threshold()).toBeLessThan(SPEECH);
  });

  it('uses a seeded floor to ignore steady background noise', () => {
    const detector = createTurnDetector({ endPauseMs: 1000, initialNoiseFloor: 0.02 });
    expect(feed(detector, 0.04, 2000).started).toBe(0);
  });
});
