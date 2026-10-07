import type { EvaMood } from '@/components/eva/Eva';

/** Every face Eva makes and when it appears (docs/ui/DESIGN_BRIEF.md 8.1), in the order Settings shows them. */
export const EVA_MOOD_GUIDE: readonly { mood: EvaMood; name: string; when: string }[] = [
  { mood: 'idle', name: 'Idle', when: 'Waiting for you' },
  { mood: 'listening', name: 'Listening', when: 'You are speaking' },
  { mood: 'processing', name: 'Processing', when: 'Turning speech into text' },
  { mood: 'thinking', name: 'Thinking', when: 'Preparing a reply' },
  { mood: 'speaking', name: 'Speaking', when: 'Eva is talking' },
  { mood: 'happy', name: 'Happy', when: 'You used a saved phrase' },
  { mood: 'encouraging', name: 'Encouraging', when: 'Not yet — try again' },
  { mood: 'curious', name: 'Curious', when: 'Follow-up or help open' },
  { mood: 'concerned', name: 'Concerned', when: 'Mic or AI problem' },
  { mood: 'asleep', name: 'Asleep', when: 'Session paused' },
];

export function nextMoodIndex(index: number): number {
  return (index + 1) % EVA_MOOD_GUIDE.length;
}
