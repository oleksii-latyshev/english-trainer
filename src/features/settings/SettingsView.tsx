import { useNavigate, useRouterState } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTrainer } from '@/context/TrainerContext';
import { FIRST_RUN_PATH } from '@/lib/firstRun';
import { isSetupDiagnostics } from '@/lib/setupTypes';
import { AppearanceSettings } from './AppearanceSettings';
import { ConversationFlowSettings } from './ConversationFlowSettings';
import { ConversationProviderSettings } from './ConversationProviderSettings';
import { EvaSettingsLink } from './EvaSettingsLink';
import { MicrophoneSettings } from './MicrophoneSettings';
import { PersonalProfileSettings } from './PersonalProfileSettings';
import { PrivacySettings } from './PrivacySettings';
import { type DiagnosticsState, SetupDetails } from './SetupDetails';
import { SpeechSettings } from './SpeechSettings';
import { TranslationSettings } from './TranslationSettings';
import { UsageSettings } from './UsageSettings';
import { VoiceSettings } from './VoiceSettings';
import './settings.css';

async function readDiagnostics() {
  const result: unknown = await invoke<unknown>('get_setup_diagnostics');
  if (!isSetupDiagnostics(result)) throw new Error('invalid-diagnostics');
  return result;
}

export function SettingsView() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({ tag: 'loading' });
  const requestGeneration = useRef(0);
  const { isSessionOpen, capture } = useTrainer();
  const navigate = useNavigate();
  const hash = useRouterState({ select: (state) => state.location.hash });

  // The sidebar's sub-navigation and Talk's "Choose microphone" arrive here with a group's id as hash.
  useEffect(() => {
    if (hash) document.getElementById(hash.replace(/^#/, ''))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  const loadDiagnostics = useCallback(async () => {
    const request = ++requestGeneration.current;
    setDiagnostics({ tag: 'loading' });
    try {
      const data = await readDiagnostics();
      if (request === requestGeneration.current) setDiagnostics({ tag: 'ready', data });
    } catch {
      if (request === requestGeneration.current) {
        setDiagnostics({
          tag: 'error',
          message: 'Setup details could not be read. Check the app installation and try again.',
        });
      }
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
    return () => {
      requestGeneration.current += 1;
    };
  }, [loadDiagnostics]);

  return (
    <div className="settings">
      <h1>Settings</h1>
      <MicrophoneSettings />
      <SpeechSettings />
      <ConversationProviderSettings />
      <TranslationSettings />
      <UsageSettings />
      <VoiceSettings />
      <AppearanceSettings />
      <EvaSettingsLink />
      <ConversationFlowSettings />
      <PersonalProfileSettings />
      <PrivacySettings />
      <SetupDetails
        onRecheck={() => void loadDiagnostics()}
        onRunSetupAgain={() => void navigate({ to: FIRST_RUN_PATH })}
        setupDisabledReason={
          isSessionOpen || !capture.canChangeSession
            ? 'Finish or end the open conversation first: setup uses the microphone.'
            : undefined
        }
        state={diagnostics}
      />
    </div>
  );
}
