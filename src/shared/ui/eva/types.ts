export type EvaMood =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'encouraging'
  | 'curious'
  | 'concerned'
  | 'asleep';

export type EvaFace = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'asleep';

export type EvaStage = 0 | 1 | 2 | 3 | 4 | 5;

export const DEFAULT_EVA_STAGE: EvaStage = 3;

const FACE_OF_MOOD = {
  idle: 'idle',
  listening: 'listening',
  processing: 'thinking',
  thinking: 'thinking',
  speaking: 'speaking',
  happy: 'happy',
  encouraging: 'idle',
  curious: 'listening',
  concerned: 'idle',
  asleep: 'asleep',
} as const satisfies Record<EvaMood, EvaFace>;

export function faceOfMood(mood: EvaMood): EvaFace {
  return FACE_OF_MOOD[mood];
}
