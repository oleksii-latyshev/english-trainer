export type HelpLevel = 'frame' | 'phrases' | 'example';

export const HELP_LEVELS: { id: HelpLevel; label: string; keyNumber: number }[] = [
  { id: 'frame', label: 'Frame', keyNumber: 1 },
  { id: 'phrases', label: 'Phrases', keyNumber: 2 },
  { id: 'example', label: 'Example', keyNumber: 3 },
];

/** What a help key does to the open level; `null` means the key is not a help key. */
export function helpLevelForKey(
  key: string,
  current: HelpLevel | null,
): { level: HelpLevel | null } | null {
  if (key.toLowerCase() === 'h') return { level: current === null ? HELP_LEVELS[0].id : null };
  const level = HELP_LEVELS.find((item) => String(item.keyNumber) === key);
  if (!level) return null;
  return { level: current === level.id ? null : level.id };
}
