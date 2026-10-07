/** The meter level (0–1 on the meter dB scale; 0.4 is about -36 dB) above which we say we can hear the learner. */
export const HEARD_SPEECH_LEVEL = 0.4;

export function isHearingSpeech(level: number | undefined): boolean {
  return level !== undefined && Number.isFinite(level) && level >= HEARD_SPEECH_LEVEL;
}

export type CheckTag = 'idle' | 'requesting' | 'recording' | 'stopping' | 'recorded' | 'error';

/** What the line beside the level meter says for the state of the check. */
export function checkStatus(tag: CheckTag, heard: boolean): { ok: boolean; text: string } {
  if (heard) return { ok: true, text: 'We can hear you' };
  switch (tag) {
    case 'requesting':
      return { ok: false, text: 'Getting ready, about 3 seconds…' };
    case 'recording':
      return { ok: false, text: 'Listening for your voice…' };
    case 'stopping':
      return { ok: false, text: 'Finishing the check…' };
    case 'recorded':
      return {
        ok: false,
        text: 'We did not hear you. Check the microphone above and try again.',
      };
    case 'idle':
    case 'error':
      return { ok: false, text: 'Press Check again, then say a sentence.' };
  }
}
