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

export function audioFrom(chunks: Float32Array[], fromSample: number): Float32Array[] {
  let skip = Math.max(0, Math.floor(fromSample));
  const result: Float32Array[] = [];
  for (const chunk of chunks) {
    if (skip >= chunk.length) {
      skip -= chunk.length;
      continue;
    }
    result.push(skip === 0 ? chunk.slice() : chunk.slice(skip));
    skip = 0;
  }
  return result;
}

export function snapshotAudioChunks(chunks: Float32Array[], sampleRateHz: number, tailMs?: number) {
  if (tailMs === undefined) return [...chunks];
  const durationMs = Math.max(0, Math.min(tailMs, 30_000));
  return audioTail(chunks, Math.floor((sampleRateHz * durationMs) / 1000));
}
