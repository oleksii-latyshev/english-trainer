// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import { measureAudioLevel, signalMeterValue, summarizeAudioSignal } from './audioSignal';

describe('measureAudioLevel', () => {
  it('returns zero rms and peak for empty buffer or non-Float32Array', () => {
    expect(measureAudioLevel(new Float32Array(0))).toEqual({ rms: 0, peak: 0 });
    // @ts-expect-error Testing non-Float32Array boundary input
    expect(measureAudioLevel(null)).toEqual({ rms: 0, peak: 0 });
    // @ts-expect-error Testing non-Float32Array boundary input
    expect(measureAudioLevel(undefined)).toEqual({ rms: 0, peak: 0 });
  });

  it('measures silence as zero amplitude', () => {
    const silence = new Float32Array([0, 0, 0, 0]);
    expect(measureAudioLevel(silence)).toEqual({ rms: 0, peak: 0 });
  });

  it('measures constant and alternating signals accurately', () => {
    const constantHalf = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const levelHalf = measureAudioLevel(constantHalf);
    expect(levelHalf.rms).toBeCloseTo(0.5, 5);
    expect(levelHalf.peak).toBeCloseTo(0.5, 5);

    const alternating = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    const levelAlt = measureAudioLevel(alternating);
    expect(levelAlt.rms).toBeCloseTo(0.5, 5);
    expect(levelAlt.peak).toBeCloseTo(0.5, 5);
  });

  it('clamps finite magnitudes exceeding 1', () => {
    const overshooting = new Float32Array([1.5, -2.0, 3.0, -1.2]);
    const level = measureAudioLevel(overshooting);
    expect(level.rms).toBeCloseTo(1.0, 5);
    expect(level.peak).toBeCloseTo(1.0, 5);
  });

  it('treats non-finite samples as zero and keeps output finite and bounded', () => {
    const nonFiniteOnly = new Float32Array([
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]);
    expect(measureAudioLevel(nonFiniteOnly)).toEqual({ rms: 0, peak: 0 });

    const mixed = new Float32Array([Number.NaN, 1.0]);
    const level = measureAudioLevel(mixed);
    expect(level.peak).toBeCloseTo(1.0, 5);
    expect(level.rms).toBeCloseTo(Math.sqrt(0.5), 5);
  });
});

describe('signalMeterValue', () => {
  it('returns zero for silence, non-positive, or below -60 dB', () => {
    expect(signalMeterValue(0)).toBe(0);
    expect(signalMeterValue(-0.5)).toBe(0);
    expect(signalMeterValue(0.001)).toBe(0);
    expect(signalMeterValue(0.0001)).toBe(0);
  });

  it('returns 1 for full scale and overshooting rms', () => {
    expect(signalMeterValue(1.0)).toBe(1);
    expect(signalMeterValue(1.5)).toBe(1);
  });

  it('never returns NaN for non-finite inputs', () => {
    expect(signalMeterValue(Number.NaN)).toBe(0);
    expect(signalMeterValue(Number.POSITIVE_INFINITY)).toBe(0);
    expect(signalMeterValue(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('maps logarithmic -60 dB to 0 dB range proportionally', () => {
    const minus40DbRms = 0.01;
    expect(signalMeterValue(minus40DbRms)).toBeCloseTo(1 / 3, 5);

    const minus20DbRms = 0.1;
    expect(signalMeterValue(minus20DbRms)).toBeCloseTo(2 / 3, 5);

    const minus30DbRms = 10 ** (-30 / 20);
    expect(signalMeterValue(minus30DbRms)).toBeCloseTo(0.5, 5);
  });
});

describe('summarizeAudioSignal', () => {
  it('partitions crossing second boundaries matching identical one-chunk samples', () => {
    const sampleRateHz = 16_000;
    const totalSamples = 40_000;
    const contiguous = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      contiguous[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRateHz) * 0.5;
    }

    const chunks = [
      contiguous.subarray(0, 5000),
      contiguous.subarray(5000, 12_000),
      contiguous.subarray(12_000, 20_000),
      contiguous.subarray(20_000, 35_000),
      contiguous.subarray(35_000, 40_000),
    ];

    const fromChunks = summarizeAudioSignal(chunks, sampleRateHz, 2500);
    const fromSingle = summarizeAudioSignal([contiguous], sampleRateHz, 2500);

    expect(fromChunks.capturedMs).toBe(fromSingle.capturedMs);
    expect(fromChunks.capturedMs).toBeCloseTo(2500, 5);
    expect(fromChunks.elapsedMs).toBe(2500);
    expect(fromChunks.windows.length).toBe(fromSingle.windows.length);
    expect(fromChunks.windows.length).toBe(3);

    for (let i = 0; i < fromChunks.windows.length; i++) {
      const wChunks = fromChunks.windows[i];
      const wSingle = fromSingle.windows[i];
      expect(wChunks.offsetMs).toBe(wSingle.offsetMs);
      expect(wChunks.durationMs).toBe(wSingle.durationMs);
      expect(wChunks.rms).toBeCloseTo(wSingle.rms, 6);
      expect(wChunks.peak).toBeCloseTo(wSingle.peak, 6);
    }
  });

  it('measures silence without inventing speech', () => {
    const sampleRateHz = 16_000;
    const chunks = [new Float32Array(16_000), new Float32Array(8000)];
    const summary = summarizeAudioSignal(chunks, sampleRateHz, 1500);

    expect(summary.capturedMs).toBeCloseTo(1500, 5);
    expect(summary.windows.length).toBe(2);
    expect(summary.windows[0]).toEqual({
      offsetMs: 0,
      durationMs: 1000,
      rms: 0,
      peak: 0,
    });
    expect(summary.windows[1]).toEqual({
      offsetMs: 1000,
      durationMs: 500,
      rms: 0,
      peak: 0,
    });
  });

  it('retains and measures a half-second final window', () => {
    const sampleRateHz = 16_000;
    const chunk = new Float32Array(24_000);
    for (let i = 16_000; i < 24_000; i++) {
      chunk[i] = 0.8;
    }

    const summary = summarizeAudioSignal([chunk], sampleRateHz, 1500);
    expect(summary.capturedMs).toBeCloseTo(1500, 5);
    expect(summary.windows.length).toBe(2);
    expect(summary.windows[1].offsetMs).toBe(1000);
    expect(summary.windows[1].durationMs).toBe(500);
    expect(summary.windows[1].peak).toBeCloseTo(0.8, 5);
    expect(summary.windows[1].rms).toBeCloseTo(0.8, 5);
  });

  it('returns empty summary on invalid sample rate or empty input', () => {
    expect(summarizeAudioSignal([], 16_000, 100)).toEqual({
      capturedMs: 0,
      elapsedMs: 100,
      windows: [],
    });
    expect(summarizeAudioSignal([new Float32Array(0)], 16_000, 100)).toEqual({
      capturedMs: 0,
      elapsedMs: 100,
      windows: [],
    });
    expect(summarizeAudioSignal([new Float32Array(100)], 0, 100)).toEqual({
      capturedMs: 0,
      elapsedMs: 100,
      windows: [],
    });
    expect(summarizeAudioSignal([new Float32Array(100)], -16_000, 100)).toEqual({
      capturedMs: 0,
      elapsedMs: 100,
      windows: [],
    });
    expect(summarizeAudioSignal([new Float32Array(100)], Number.NaN, 100)).toEqual({
      capturedMs: 0,
      elapsedMs: 100,
      windows: [],
    });
  });

  it('yields finite bounded values for non-finite sample inputs and invalid elapsedMs', () => {
    const chunk = new Float32Array([Number.NaN, Number.POSITIVE_INFINITY, 2.5]);
    const summary = summarizeAudioSignal([chunk], 16_000, -500);

    expect(summary.elapsedMs).toBe(0);
    expect(Number.isFinite(summary.capturedMs)).toBe(true);
    expect(summary.windows.length).toBe(1);
    expect(Number.isFinite(summary.windows[0].rms)).toBe(true);
    expect(Number.isFinite(summary.windows[0].peak)).toBe(true);
    expect(summary.windows[0].rms).toBeLessThanOrEqual(1);
    expect(summary.windows[0].peak).toBeLessThanOrEqual(1);
  });
});
