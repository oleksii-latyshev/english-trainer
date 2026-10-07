import type { MicrophoneStatus } from '@/audio/microphoneManager';

export type MicStatusBox = { isOn: boolean; title: string; hint: string };

function offHint(status: MicrophoneStatus): string {
  if (status === 'paused') return 'Released while paused.';
  if (status === 'error') return 'Not available right now.';
  return 'Opens when a conversation starts.';
}

/**
 * The sidebar's microphone box. "On" means the warm session holds the device (opening, warming or
 * ready); paused, failed and idle microphones are all released.
 */
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
