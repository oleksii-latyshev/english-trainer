export function createCaptureStartup(sampleRateHz: number) {
  const requiredSamples = Math.ceil(sampleRateHz * 3);
  let receivedSamples = 0;
  return {
    accept(sampleCount: number): boolean {
      if (Number.isFinite(sampleCount) && sampleCount > 0) receivedSamples += sampleCount;
      return receivedSamples >= requiredSamples;
    },
  };
}
