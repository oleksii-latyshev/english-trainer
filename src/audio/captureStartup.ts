export function createCaptureStartup(sampleRateHz: number) {
  // Measured Mac input ramps for ~3 seconds. Warm up before Recording, without speech detection.
  const requiredSamples = Math.ceil(sampleRateHz * 3);
  let receivedSamples = 0;
  return {
    accept(sampleCount: number): boolean {
      if (Number.isFinite(sampleCount) && sampleCount > 0) receivedSamples += sampleCount;
      return receivedSamples >= requiredSamples;
    },
  };
}
