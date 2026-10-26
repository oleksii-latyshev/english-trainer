import type { MicrophoneStatus } from '@/core/audio';

export type MicStatusBox = { isOn: boolean; title: string; hint: string };

function offHint(status: MicrophoneStatus): string {
  if (status === 'paused') return 'Released while paused.';
  if (status === 'error') return 'Not available right now.';
  return 'Opens for spoken practice.';
}

export function micStatusBox(status: MicrophoneStatus): MicStatusBox {
  const isOn = status === 'opening' || status === 'warming' || status === 'ready';
  if (isOn) {
    return {
      isOn,
      title: 'Microphone on',
      hint: 'Kept warm for instant turns. Pause to release it.',
    };
  }
  return { isOn, title: 'Microphone off', hint: offHint(status) };
}
