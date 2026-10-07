export function encodeWav(chunks: Float32Array[], sampleCount: number, sampleRateHz: number): Blob {
  const data = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(data);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, data.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([data], { type: 'audio/wav' });
}

export async function resampleForWhisper(
  chunks: Float32Array[],
  sampleCount: number,
  sourceRateHz: number,
): Promise<Float32Array> {
  const targetRateHz = 16_000;
  const outputLength = Math.ceil((sampleCount * targetRateHz) / sourceRateHz);
  const offline = new OfflineAudioContext(1, outputLength, targetRateHz);
  const sourceBuffer = offline.createBuffer(1, sampleCount, sourceRateHz);
  const samples = sourceBuffer.getChannelData(0);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  const source = offline.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
