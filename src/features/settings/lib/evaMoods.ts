import type { EvaMood } from '@/shared/ui/eva';

export const EVA_MOOD_GUIDE: readonly { mood: EvaMood; name: string; when: string }[] = [
  { mood: 'listening', name: 'Listening', when: 'You are speaking' },
  { mood: 'thinking', name: 'Thinking', when: 'Eva prepares a reply' },
  { mood: 'speaking', name: 'Speaking', when: 'Eva talks' },
  { mood: 'happy', name: 'Happy', when: 'You said it well' },
  { mood: 'idle', name: 'Encouraging', when: 'Try again, no rush' },
  { mood: 'asleep', name: 'Asleep', when: 'Paused or days off' },
];

export function nextMoodIndex(index: number): number {
  return (index + 1) % EVA_MOOD_GUIDE.length;
}
