export type FirstRunScreenProps = {
  readonly isPracticeCapturing: boolean;
  readonly onBeforeMicrophoneCheck: () => void;
  readonly onFinish: () => void;
  readonly onSkip: () => void;
};
