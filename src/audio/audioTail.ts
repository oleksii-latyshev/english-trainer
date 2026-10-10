/** Copies the newest sample range without consuming or modifying the full answer buffer. */
export function audioTail(chunks: Float32Array[], maxSamples: number): Float32Array[] {
  let remaining = Math.max(0, Math.floor(maxSamples));
  const result: Float32Array[] = [];
  for (let index = chunks.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const chunk = chunks[index];
    if (!chunk) continue;
    const count = Math.min(remaining, chunk.length);
    result.unshift(chunk.slice(chunk.length - count));
    remaining -= count;
  }
  return result;
}

export function snapshotAudioChunks(chunks: Float32Array[], sampleRateHz: number, tailMs?: number) {
  if (tailMs === undefined) return [...chunks];
  const durationMs = Math.max(0, Math.min(tailMs, 30_000));
  return audioTail(chunks, Math.floor((sampleRateHz * durationMs) / 1000));
}
