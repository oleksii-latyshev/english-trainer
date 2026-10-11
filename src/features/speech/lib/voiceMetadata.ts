/** macOS ships these joke and effect voices as English; none of them is a voice to practise with. */
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

/** macOS marks better voices in the name: "Ava (Premium)", "Zoe (Enhanced)". */
export function voiceQuality(name: string | undefined): 'premium' | 'enhanced' | 'standard' {
  const lower = (name ?? '').toLowerCase();
  if (lower.includes('(premium)')) return 'premium';
  if (lower.includes('(enhanced)')) return 'enhanced';
  return 'standard';
}
