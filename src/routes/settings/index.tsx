import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTrainer } from '@/context/TrainerContext';
import { FIRST_RUN_PATH } from '@/lib/firstRun';
import {
  EVA_SETTINGS_PATH,
  isSettingsSectionId,
  SettingsEvaScreen,
  SettingsScreen,
} from '@/screens/settings';

function setupDisabledReason(isBlocked: boolean): string | undefined {
  return isBlocked
    ? 'Finish or end the open conversation first: setup uses the microphone.'
    : undefined;
}

export function SettingsRoute() {
  const { isSessionOpen, capture, speech } = useTrainer();
  const navigate = useNavigate();
  const hash = useRouterState({ select: (state) => state.location.hash }).replace(/^#/, '');
  const isPracticeCapturing = !capture.canChangeSession;

  return (
    <SettingsScreen
      focusedSection={isSettingsSectionId(hash) ? hash : undefined}
      isPracticeCapturing={isPracticeCapturing}
      onBeforeRecord={speech.stop}
      onOpenEva={() => void navigate({ to: EVA_SETTINGS_PATH })}
      onRunSetupAgain={() => void navigate({ to: FIRST_RUN_PATH })}
      setupDisabledReason={setupDisabledReason(isSessionOpen || isPracticeCapturing)}
      systemVoices={{
        voices: speech.voices.map(({ voice, isEnglish }) => ({
          voiceURI: voice.voiceURI,
          name: voice.name,
          lang: voice.lang,
          isEnglish,
        })),
        selectedVoiceURI: speech.selectedVoiceURI,
        isPlaying: speech.state.tag === 'starting' || speech.state.tag === 'speaking',
        hasPlaybackError: speech.state.tag === 'error',
        onSelect: speech.selectVoice,
        onPreview: () => speech.play('Hi, I am Eva. This is how I will sound.'),
      }}
    />
  );
}

export function SettingsEvaRoute() {
  const navigate = useNavigate();
  return <SettingsEvaScreen onBack={() => void navigate({ to: '/settings' })} />;
}
