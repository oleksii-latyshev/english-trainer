import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTrainer } from '@/context/TrainerContext';
import { AiProviderSettings } from '@/features/ai-provider';
import { ApiUsageSettings } from '@/features/api-usage';
import { AppearanceSettings } from '@/features/appearance';
import { ConversationFlowSettings } from '@/features/conversation-flow-settings';
import { GeminiKeyField } from '@/features/gemini-key';
import { Glossary } from '@/features/glossary';
import { MicrophoneSettings } from '@/features/microphone-settings';
import { AboutYou } from '@/features/personal-profile';
import { PrivacySettings } from '@/features/privacy';
import { SetupDetails } from '@/features/setup-details';
import { SpeechRecognitionSettings } from '@/features/speech-recognition-settings';
import { TranslationSettings } from '@/features/translation-settings';
import { VoiceSettings } from '@/features/voice-settings';
import { FIRST_RUN_PATH } from '@/lib/firstRun';
import { GroupCard } from '@/shared/ui/group-card';
import { EvaSettingsLink } from './EvaSettingsLink';
import { VoiceSelection } from './VoiceSelection';
import './settings.css';

export function SettingsView() {
  const { isSessionOpen, capture, speech } = useTrainer();
  const navigate = useNavigate();
  const hash = useRouterState({ select: (state) => state.location.hash });
  const isPracticeCapturing = !capture.canChangeSession;

  useEffect(() => {
    if (hash) document.getElementById(hash.replace(/^#/, ''))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="settings">
      <h1>Settings</h1>
      <MicrophoneSettings
        isDeviceFocused={hash === 'microphone'}
        isPracticeCapturing={isPracticeCapturing}
        onBeforeRecord={speech.stop}
      />
      <SpeechRecognitionSettings isPracticeCapturing={isPracticeCapturing} />
      <GroupCard id="ai" title="Conversation AI">
        <AiProviderSettings geminiKeyField={<GeminiKeyField />} />
      </GroupCard>
      <TranslationSettings />
      <GroupCard id="usage" title="Usage">
        <ApiUsageSettings />
      </GroupCard>
      <VoiceSettings systemVoices={<VoiceSelection />} />
      <AppearanceSettings />
      <EvaSettingsLink />
      <ConversationFlowSettings />
      <GroupCard id="personalisation" title="Personalisation">
        <AboutYou />
        <Glossary />
      </GroupCard>
      <PrivacySettings />
      <SetupDetails
        onRunSetupAgain={() => void navigate({ to: FIRST_RUN_PATH })}
        setupDisabledReason={
          isSessionOpen || isPracticeCapturing
            ? 'Finish or end the open conversation first: setup uses the microphone.'
            : undefined
        }
      />
    </div>
  );
}
