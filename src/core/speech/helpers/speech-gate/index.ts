const MIN_SPEECH_LEVEL = 0.006;

export type SpeechGate = {
  readonly sample: (level: number) => void;
  readonly hasHeardSpeech: () => boolean;
};

export function createSpeechGate(): SpeechGate {
  let heard = false;
  return {
    sample: (level) => {
      if (level > MIN_SPEECH_LEVEL) heard = true;
    },
    hasHeardSpeech: () => heard,
  };
}
