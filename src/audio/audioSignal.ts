export type AudioSignalWindow = {
  offsetMs: number;
  durationMs: number;
  rms: number;
  peak: number;
};

export type AudioSignalSummary = {
  capturedMs: number;
  elapsedMs: number;
  windows: AudioSignalWindow[];
};

export type AudioLevel = {
  rms: number;
  peak: number;
};

export function measureAudioLevel(samples: Float32Array): AudioLevel {
  if (!(samples instanceof Float32Array) || samples.length === 0) {
    return { rms: 0, peak: 0 };
  }

  const sampleCount = samples.length;
  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < sampleCount; i++) {
    const sample = samples[i];
    if (Number.isFinite(sample)) {
      const magnitude = Math.min(1, Math.abs(sample));
      if (magnitude > peak) {
        peak = magnitude;
      }
      sumSquares += magnitude * magnitude;
    }
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  return { rms, peak };
}

export function signalMeterValue(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) {
    return 0;
  }
  if (rms >= 1) {
    return 1;
  }

  const db = 20 * Math.log10(rms);
  if (db <= -60) {
    return 0;
  }

  const normalized = (db + 60) / 60;
  return Math.max(0, Math.min(1, normalized));
}

export function summarizeAudioSignal(
  chunks: Float32Array[],
  sampleRateHz: number,
  elapsedMs: number,
): AudioSignalSummary {
  const sanitizedElapsedMs =
    typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : 0;

  if (
    typeof sampleRateHz !== 'number' ||
    !Number.isFinite(sampleRateHz) ||
    sampleRateHz <= 0 ||
    !Array.isArray(chunks)
  ) {
    return {
      capturedMs: 0,
      elapsedMs: sanitizedElapsedMs,
      windows: [],
    };
  }

  const windowSizeSamples = Math.round(sampleRateHz);
  if (windowSizeSamples <= 0) {
    return {
      capturedMs: 0,
      elapsedMs: sanitizedElapsedMs,
      windows: [],
    };
  }

  const windows: AudioSignalWindow[] = [];
  let totalSamples = 0;
  let windowSamples = 0;
  let sumSquares = 0;
  let peak = 0;
  const flush = () => {
    if (!windowSamples) return;
    windows.push({
      offsetMs: ((totalSamples - windowSamples) / sampleRateHz) * 1000,
      durationMs: (windowSamples / sampleRateHz) * 1000,
      rms: Math.sqrt(sumSquares / windowSamples),
      peak,
    });
    windowSamples = 0;
    sumSquares = 0;
    peak = 0;
  };

  // Aggregate in place so diagnostics do not create another full raw-audio copy.
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const magnitude = Number.isFinite(sample) ? Math.min(1, Math.abs(sample)) : 0;
      sumSquares += magnitude * magnitude;
      peak = Math.max(peak, magnitude);
      windowSamples += 1;
      totalSamples += 1;
      if (windowSamples === windowSizeSamples) flush();
    }
  }
  flush();
  return {
    capturedMs: (totalSamples / sampleRateHz) * 1000,
    elapsedMs: sanitizedElapsedMs,
    windows,
  };
}
