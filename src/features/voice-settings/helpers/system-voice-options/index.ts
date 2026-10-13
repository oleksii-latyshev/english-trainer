export type SystemVoice = {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly isEnglish: boolean;
};

export function systemVoiceOptions(voices: readonly SystemVoice[]) {
  return voices.map(({ voiceURI, name, lang, isEnglish }) => ({
    value: voiceURI,
    label: `${name} (${lang})${isEnglish ? '' : ' · not English'}`,
  }));
}
