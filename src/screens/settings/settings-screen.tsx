import { useEffect } from 'react';
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
import { SystemVoices, VoiceSettings } from '@/features/voice-settings';
import { GroupCard } from '@/shared/ui/group-card';
import { EvaLink } from './eva-link';
import type { SettingsScreenProps } from './types';

export function SettingsScreen({
  focusedSection,
  isPracticeCapturing,
  setupDisabledReason,
  systemVoices,
  onBeforeRecord,
  onOpenEva,
  onRunSetupAgain,
}: SettingsScreenProps) {
  useEffect(() => {
    if (focusedSection) document.getElementById(focusedSection)?.scrollIntoView({ block: 'start' });
  }, [focusedSection]);

  return (
    <div className="mx-auto flex max-w-205 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted">Everything stays on this Mac unless a section says otherwise.</p>
      </header>
      <MicrophoneSettings
        isDeviceFocused={focusedSection === 'microphone'}
        isPracticeCapturing={isPracticeCapturing}
        onBeforeRecord={onBeforeRecord}
      />
      <GroupCard id="ai" title="Conversation AI">
        <AiProviderSettings geminiKeyField={<GeminiKeyField />} />
      </GroupCard>
      <VoiceSettings systemVoices={<SystemVoices {...systemVoices} />} />
      <SpeechRecognitionSettings isPracticeCapturing={isPracticeCapturing} />
      <EvaLink onOpen={onOpenEva} />
      <ConversationFlowSettings />
      <TranslationSettings />
      <GroupCard id="personalisation" title="Personalisation">
        <AboutYou />
        <Glossary />
      </GroupCard>
      <PrivacySettings />
      <GroupCard id="usage" title="Usage">
        <ApiUsageSettings />
      </GroupCard>
      <AppearanceSettings />
      <SetupDetails onRunSetupAgain={onRunSetupAgain} setupDisabledReason={setupDisabledReason} />
    </div>
  );
}
