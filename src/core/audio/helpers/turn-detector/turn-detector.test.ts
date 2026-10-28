import { describe, expect, it } from 'bun:test';
import { createNoiseFloorTracker, createTurnDetector, type TurnDetector } from '.';

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

type Segment = { readonly rms: number; readonly forMs: number };

function longAnswer(): Segment[] {
  const segments: Segment[] = [];
  for (let spokenMs = 0; spokenMs < 60_000; spokenMs += 5000) {
    for (let word = 0; word < 10; word += 1) {
      segments.push({ rms: SPEECH, forMs: 360 }, { rms: 0.005, forMs: 100 });
    }
    segments.push({ rms: 0.005, forMs: 300 }, { rms: QUIET, forMs: 700 + (spokenMs % 3) * 200 });
    segments.push({ rms: 0.005, forMs: 500 }, { rms: SPEECH, forMs: 200 });
  }
  return segments;
}

function endedAt(
  detector: Pick<TurnDetector, 'push'>,
  segments: readonly Segment[],
): number | null {
  let clock = 0;
  for (const segment of segments) {
    for (let t = 0; t < segment.forMs; t += FRAME_MS) {
      clock += FRAME_MS;
      if (detector.push(segment.rms, FRAME_MS).turnEnded) return clock;
    }
  }
  return null;
}

function createLegacyDetector(endPauseMs: number): Pick<TurnDetector, 'push'> {
  const noise = createNoiseFloorTracker(QUIET);
  let burstMs = 0;
  let silenceMs = 0;
  let confirmed = false;
  return {
    push(rms, durationMs) {
      const isSpeech = rms > noise.threshold();
      if (!(isSpeech && confirmed)) noise.update(rms, durationMs);
      if (!isSpeech) {
        silenceMs += durationMs;
        return { speechStarted: false, turnEnded: confirmed && silenceMs >= endPauseMs };
      }
      burstMs += durationMs;
      silenceMs = 0;
      const speechStarted = !confirmed && burstMs >= 300;
      confirmed = confirmed || speechStarted;
      return { speechStarted, turnEnded: false };
    },
  };
}

describe('turn detector on a long answer', () => {
  it('the previous logic ends the same recording mid-sentence', () => {
    expect(endedAt(createLegacyDetector(1500), longAnswer())).not.toBeNull();
  });

  it('keeps the turn open through syllable dips, soft endings and thinking pauses', () => {
    const detector = createTurnDetector({ endPauseMs: 1500, initialNoiseFloor: QUIET });
    expect(endedAt(detector, longAnswer())).toBeNull();
  });

  it('still ends within the end pause plus one frame after the answer', () => {
    const detector = createTurnDetector({ endPauseMs: 1500, initialNoiseFloor: QUIET });
    const answer = longAnswer();
    const answerMs = answer.reduce((sum, segment) => sum + segment.forMs, 0);
    const ended = endedAt(detector, [...answer, { rms: QUIET, forMs: 3000 }]);
    expect(ended).not.toBeNull();
    expect(ended ?? 0).toBeLessThanOrEqual(answerMs + 1500 + FRAME_MS);
    expect(ended ?? 0).toBeGreaterThan(answerMs + 1500 - FRAME_MS * 2);
  });

  it('waits the extra pause after an unfinished clause and drops it when cleared', () => {
    const detector = createTurnDetector({ endPauseMs: 1000, initialNoiseFloor: QUIET });
    feed(detector, SPEECH, 600);
    detector.setExtraPauseMs(1200);
    expect(feed(detector, QUIET, 2100).ended).toBe(0);
    expect(feed(detector, QUIET, 200).ended).toBe(1);
  });

  it('ends at the plain pause once the extra pause is cleared', () => {
    const detector = createTurnDetector({ endPauseMs: 1000, initialNoiseFloor: QUIET });
    feed(detector, SPEECH, 600);
    detector.setExtraPauseMs(1200);
    feed(detector, QUIET, 1100);
    detector.setExtraPauseMs(0);
    expect(feed(detector, QUIET, 20).ended).toBe(1);
  });

  it('never lets the floor rise during a confirmed answer', () => {
    const detector = createTurnDetector({ endPauseMs: 1500, initialNoiseFloor: QUIET });
    feed(detector, SPEECH, 600);
    feed(detector, 0.005, 20_000);
    expect(feed(detector, QUIET, 1400).ended).toBe(0);
    expect(feed(detector, QUIET, 200).ended).toBe(1);
  });
});

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
