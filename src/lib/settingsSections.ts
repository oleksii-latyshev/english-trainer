export const EVA_SETTINGS_PATH = '/settings/eva';

/**
 * The groups of the Settings screen in display order; `id` is the anchor and the router hash.
 * Personalisation (profile, glossary) joins when F8/F3 store them; see docs/ROADMAP.md.
 */
export const SETTINGS_SECTIONS = [
  { id: 'microphone', label: 'Microphone' },
  { id: 'ai', label: 'Conversation AI' },
  { id: 'usage', label: 'Usage' },
  { id: 'voice', label: 'Voice' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'eva', label: 'Eva' },
  { id: 'flow', label: 'Conversation flow' },
  { id: 'privacy', label: 'Privacy' },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export function isSettingsSectionId(value: unknown): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

/** The sub-navigation entry to highlight: Eva has a page of its own, the rest follow the hash. */
export function activeSettingsSection(
  pathname: string,
  hash: string,
): SettingsSectionId | undefined {
  if (pathname === EVA_SETTINGS_PATH) return 'eva';
  if (pathname !== '/settings') return undefined;
  const id = hash.replace(/^#/, '');
  return isSettingsSectionId(id) ? id : undefined;
}

export function isSettingsPath(pathname: string): boolean {
  return pathname === '/settings' || pathname === EVA_SETTINGS_PATH;
}
