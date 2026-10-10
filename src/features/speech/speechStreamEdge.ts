import type { SpeechStreamState, StreamOptions } from './lib/speechStream';

export type StreamSession = {
  generation: number;
  synthesis: SpeechSynthesis;
  voice: SpeechSynthesisVoice;
  rate: number;
  options: StreamOptions;
  queue: string[];
  stream: SpeechStreamState;
  isSpeaking: boolean;
  isFinished: boolean;
  didStart: boolean;
  didError: boolean;
  didEnd: boolean;
};
