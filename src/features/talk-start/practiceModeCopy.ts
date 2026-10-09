import type { PracticeMode } from '@/lib/practiceOptions';

export function modeDescription(mode: PracticeMode): string {
  switch (mode) {
    case 'voice':
      return 'Speak with Eva and hear her replies.';
    case 'text_chat':
      return 'Write a conversation with Eva.';
    case 'write_then_speak':
      return 'Write first, review, then answer aloud.';
  }
}

export function introduction(mode: PracticeMode): string {
  switch (mode) {
    case 'voice':
      return 'Choose a topic and a suggested length. Eva will ask short questions; answer out loud and get quiet notes as you go.';
    case 'text_chat':
      return 'Choose a topic and a suggested length. Write with Eva and get quiet notes as you go.';
    case 'write_then_speak':
      return 'Choose a topic and a suggested length. Write with Eva, review the notes, then answer the same questions aloud.';
  }
}
