// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { audioTail, snapshotAudioChunks } from './audioTail';

describe('rescue audio snapshot', () => {
  it('keeps recent samples in order without consuming the complete answer', () => {
    const chunks = [new Float32Array([1, 2, 3]), new Float32Array([4, 5])];
    const tail = audioTail(chunks, 3);
    expect(tail.flatMap((chunk) => Array.from(chunk))).toEqual([3, 4, 5]);
    expect(chunks.flatMap((chunk) => Array.from(chunk))).toEqual([1, 2, 3, 4, 5]);
    if (tail[0]) tail[0][0] = 9;
    expect(chunks[0]?.[2]).toBe(3);
  });
  it('handles empty, short and zero-length snapshots', () => {
    expect(audioTail([], 10)).toEqual([]);
    expect(audioTail([new Float32Array([1])], 0)).toEqual([]);
    expect(audioTail([new Float32Array([1])], 10)[0]).toEqual(new Float32Array([1]));
  });
  it('bounds an explicit duration while leaving the final full snapshot intact', () => {
    const chunks = [new Float32Array(40_000).fill(1)];
    expect(snapshotAudioChunks(chunks, 1000, 15_000)[0]?.length).toBe(15_000);
    expect(snapshotAudioChunks(chunks, 1000, 60_000)[0]?.length).toBe(30_000);
    expect(snapshotAudioChunks(chunks, 1000)[0]?.length).toBe(40_000);
    expect(snapshotAudioChunks(chunks, 1000, -1)).toEqual([]);
  });
});
