const UNFINISHED_CLAUSE_PAUSE_MS = 1200;

const OPEN_ENDINGS = new Set([
  'and',
  'but',
  'or',
  'so',
  'because',
  'that',
  'which',
  'who',
  'when',
  'if',
  'than',
  'like',
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'about',
  'from',
  'my',
  'your',
  'our',
  'their',
  'is',
  'are',
  'was',
  'were',
  'have',
  'has',
  'will',
  'would',
  'can',
  'could',
  'i',
  'we',
  'they',
]);

export function unfinishedClausePauseMs(liveText: string): number {
  const text = liveText.trimEnd();
  if (text.endsWith(',')) return UNFINISHED_CLAUSE_PAUSE_MS;
  const lastWord = text.match(/([\p{L}']+)[^\p{L}']*$/u)?.[1]?.toLowerCase();
  if (lastWord === undefined || /[.!?…]$/.test(text)) return 0;
  return OPEN_ENDINGS.has(lastWord) ? UNFINISHED_CLAUSE_PAUSE_MS : 0;
}
