import type { SystemVoicesProps } from '@/features/voice-settings';

export type FirstRunScreenProps = {
  readonly systemVoices: SystemVoicesProps;
  readonly isPracticeCapturing: boolean;
  readonly onBeforeMicrophoneCheck: () => void;
  readonly onFinish: () => void;
  readonly onSkip: () => void;
};
