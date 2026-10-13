import type { SystemVoicesProps } from '@/features/voice-settings';
import type { SettingsSectionId } from './sections';

export type SettingsScreenProps = {
  readonly focusedSection: SettingsSectionId | undefined;
  readonly isPracticeCapturing: boolean;
  readonly setupDisabledReason: string | undefined;
  readonly systemVoices: SystemVoicesProps;
  readonly onBeforeRecord: () => void;
  readonly onOpenEva: () => void;
  readonly onRunSetupAgain: () => void;
};

export type SettingsEvaScreenProps = {
  readonly onBack: () => void;
};
