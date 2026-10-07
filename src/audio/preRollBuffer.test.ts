// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { createPreRollBuffer } from './preRollBuffer';

function ramp(start: number, length: number): Float32Array {
  return Float32Array.from({ length }, (_, i) => start + i);
}

function flatten(chunks: Float32Array[]): number[] {
  return chunks.flatMap((chunk) => Array.from(chunk));
}

describe('pre-roll buffer', () => {
  it('returns everything while below capacity', () => {
    const buffer = createPreRollBuffer(10);
    buffer.push(ramp(0, 3));
    buffer.push(ramp(3, 3));
    expect(flatten(buffer.snapshot(10))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(buffer.sampleCount()).toBe(6);
  });

  it('drops the oldest whole chunks once capacity is exceeded', () => {
    const buffer = createPreRollBuffer(6);
    for (let i = 0; i < 5; i++) buffer.push(ramp(i * 3, 3));
    expect(flatten(buffer.snapshot(100))).toEqual([9, 10, 11, 12, 13, 14]);
    expect(buffer.sampleCount()).toBe(6);
  });

  it('trims the oldest returned chunk to the requested length', () => {
    const buffer = createPreRollBuffer(12);
    buffer.push(ramp(0, 4));
    buffer.push(ramp(4, 4));
    expect(flatten(buffer.snapshot(5))).toEqual([3, 4, 5, 6, 7]);
    expect(buffer.snapshot(0)).toEqual([]);
  });

  it('clears and ignores everything with zero capacity', () => {
    const buffer = createPreRollBuffer(4);
    buffer.push(ramp(0, 4));
    buffer.clear();
    expect(buffer.snapshot(4)).toEqual([]);
    const empty = createPreRollBuffer(0);
    empty.push(ramp(0, 4));
    expect(empty.sampleCount()).toBe(0);
  });
});
