export const EVA_SETTINGS_PATH = '/settings/eva';

export const SETTINGS_SECTIONS = [
  { id: 'microphone', label: 'Microphone' },
  { id: 'ai', label: 'Conversation AI' },
  { id: 'voice', label: 'Voice' },
  { id: 'speech', label: 'Speech recognition' },
  { id: 'eva', label: 'Eva' },
  { id: 'flow', label: 'Conversation flow' },
  { id: 'translation', label: 'Translation' },
  { id: 'personalisation', label: 'Personalisation' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'usage', label: 'Usage' },
  { id: 'appearance', label: 'Appearance' },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export function isSettingsSectionId(value: unknown): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

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
