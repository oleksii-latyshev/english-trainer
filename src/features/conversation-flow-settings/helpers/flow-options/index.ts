import {
  AUTO_SEND_CHOICES_MS,
  type AutoSendChoice,
  END_PAUSE_CHOICES_MS,
} from '@/core/conversation-flow';

function seconds(ms: number): string {
  return `${ms / 1000} s`;
}

export const END_PAUSE_OPTIONS = END_PAUSE_CHOICES_MS.map((ms) => ({
  value: ms,
  label: seconds(ms),
}));

export const AUTO_SEND_OPTIONS: readonly { value: AutoSendChoice; label: string }[] = [
  { value: 'off', label: 'Off' },
  ...AUTO_SEND_CHOICES_MS.map((ms) => ({ value: ms, label: seconds(ms) })),
];
