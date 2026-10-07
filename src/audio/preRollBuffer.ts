export type PreRollBuffer = {
  push: (chunk: Float32Array) => void;
  /** The most recent audio, oldest first, trimmed to at most `maxSamples`. */
  snapshot: (maxSamples: number) => Float32Array[];
  sampleCount: () => number;
  clear: () => void;
};

/** Keeps the latest `capacitySamples` of audio in memory so a capture can include what came just before it started. */
export function createPreRollBuffer(capacitySamples: number): PreRollBuffer {
  const capacity = Math.max(0, Math.floor(capacitySamples));
  let chunks: Float32Array[] = [];
  let total = 0;

  return {
    push(chunk) {
      if (chunk.length === 0 || capacity === 0) return;
      chunks.push(chunk);
      total += chunk.length;
      let drop = 0;
      while (drop < chunks.length - 1 && total - chunks[drop].length >= capacity) {
        total -= chunks[drop].length;
        drop += 1;
      }
      if (drop > 0) chunks = chunks.slice(drop);
    },
    snapshot(maxSamples) {
      let remaining = Math.max(0, Math.min(Math.floor(maxSamples), total));
      const picked: Float32Array[] = [];
      for (let i = chunks.length - 1; i >= 0 && remaining > 0; i--) {
        const chunk = chunks[i];
        picked.push(chunk.length <= remaining ? chunk : chunk.subarray(chunk.length - remaining));
        remaining -= Math.min(chunk.length, remaining);
      }
      return picked.reverse();
    },
    sampleCount: () => total,
    clear() {
      chunks = [];
      total = 0;
    },
  };
}
