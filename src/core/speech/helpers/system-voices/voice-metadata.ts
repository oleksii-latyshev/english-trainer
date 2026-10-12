const NOVELTY_VOICES = new Set([
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'good news',
  'jester',
  'organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
]);

export function isNoveltyVoice(name: string | undefined): boolean {
  return NOVELTY_VOICES.has(
    (name ?? '')
      .replace(/\s*\(.*\)\s*$/, '')
      .trim()
      .toLowerCase(),
  );
}

export function voiceQuality(name: string | undefined): 'premium' | 'enhanced' | 'standard' {
  const lower = (name ?? '').toLowerCase();
  if (lower.includes('(premium)')) return 'premium';
  if (lower.includes('(enhanced)')) return 'enhanced';
  return 'standard';
}
