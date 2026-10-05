import { Button, Card } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTrainer } from '@/context/TrainerContext';
import { isSetupDiagnostics } from '@/lib/setupTypes';
import type { ConversationProviderId, SetupDiagnostics } from '@/lib/types';
import { ConversationProviderSettings } from './ConversationProviderSettings';
import { MicrophoneSettings } from './MicrophoneSettings';
import { ProviderResponseTest } from './ProviderResponseTest';

type DiagnosticsState =
  | { tag: 'loading' }
  | { tag: 'ready'; data: SetupDiagnostics }
  | { tag: 'error'; message: string };

function DiagnosticRow({ label, check }: { label: string; check: SetupDiagnostics['agy_cli'] }) {
  const statusLabel = {
    available: 'Found',
    missing: 'Missing',
    unreadable: 'Cannot read',
  }[check.status];
  const color = check.status === 'available' ? 'text-emerald-300' : 'text-amber-300';
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{label}</h3>
        <span className={`text-xs font-medium ${color}`}>{statusLabel}</span>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-zinc-400">
        {check.path ?? 'Path not found'}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-300">{check.message}</p>
    </div>
  );
}

async function readDiagnostics(): Promise<SetupDiagnostics> {
  const result: unknown = await invoke<unknown>('get_setup_diagnostics');
  if (!isSetupDiagnostics(result)) throw new Error('invalid-diagnostics');
  return result;
}

export function SettingsHardwareView() {
  const { speech } = useTrainer();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({ tag: 'loading' });
  const [savedProvider, setSavedProvider] = useState<ConversationProviderId | null>(null);
  const requestGeneration = useRef(0);
  const handleSavedProviderChange = useCallback((provider: ConversationProviderId) => {
    setSavedProvider(provider);
  }, []);

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

  const selectedVoice = speech.voices.find(
    (option) => option.voice.voiceURI === speech.selectedVoiceURI,
  );
  const voiceUnavailable = speech.voices.length === 0;
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">SETTINGS</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">Setup and voice</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Review the files this app detected and choose how questions are spoken. Microphone access
          is checked by the system when you make your first recording.
        </p>
      </header>

      <Card className="border border-white/[0.08] bg-[#161619] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Local setup</h2>
            <p className="mt-1 text-xs text-zinc-400">Detected paths and messages from this app.</p>
          </div>
          <Button onPress={() => void loadDiagnostics()} size="sm" variant="secondary">
            Recheck files
          </Button>
        </div>
        {diagnostics.tag === 'loading' && (
          <p className="mt-4 text-sm text-zinc-400" role="status">
            Checking setup…
          </p>
        )}
        {diagnostics.tag === 'error' && (
          <p className="mt-4 text-sm text-rose-300" role="alert">
            {diagnostics.message}
          </p>
        )}
        {diagnostics.tag === 'ready' && (
          <div className="mt-4 flex flex-col gap-3">
            <DiagnosticRow check={diagnostics.data.whisper_cli} label="Whisper command" />
            <DiagnosticRow check={diagnostics.data.whisper_model} label="Whisper model" />
            <DiagnosticRow check={diagnostics.data.agy_cli} label="agy command" />
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Local database</h3>
              <p className="mt-1 break-all font-mono text-xs text-zinc-400">
                {diagnostics.data.database_path}
              </p>
            </div>
          </div>
        )}
        {diagnostics.tag === 'ready' && diagnostics.data.whisper_cli.status !== 'available' && (
          <p className="mt-4 text-xs leading-relaxed text-zinc-400">
            Install the missing Whisper command with <code>brew install whisper.cpp</code>, then
            recheck files.
          </p>
        )}
        {diagnostics.tag === 'ready' && diagnostics.data.whisper_model.status !== 'available' && (
          <p className="mt-4 text-xs leading-relaxed text-zinc-400">
            Follow the README’s Local transcription setup instructions to install the English model
            at the path shown above, then recheck files.
          </p>
        )}
        {diagnostics.tag === 'ready' && diagnostics.data.agy_cli.status !== 'available' && (
          <p className="mt-4 text-xs leading-relaxed text-zinc-400">
            To use AI replies, install Antigravity CLI and complete its sign-in flow. See README →
            Personal Alpha setup, then recheck files.
          </p>
        )}
      </Card>

      <ConversationProviderSettings
        onSavedProviderChange={handleSavedProviderChange}
        defaultModel={diagnostics.tag === 'ready' ? diagnostics.data.agy_default_model : undefined}
      />

      <MicrophoneSettings />

      <Card className="border border-white/[0.08] bg-[#161619] p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Question voice</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Uses voices provided by your system. No voice is assumed to be installed.
          </p>
        </div>
        {voiceUnavailable ? (
          <p className="mt-4 text-sm text-amber-200">
            No system speech voices are currently available.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-xs text-zinc-300">
              Voice
              <select
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                onChange={(event) => {
                  const value = event.target.value;
                  speech.selectVoice(value);
                }}
                value={speech.selectedVoiceURI ?? ''}
              >
                {speech.voices.map(({ voice, isEnglish }) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang}){isEnglish ? ' · English' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-zinc-300">
              Playback speed: {speech.rate.toFixed(2)}×
              <input
                max="1.2"
                min="0.85"
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  speech.setRate(value);
                }}
                step="0.05"
                type="range"
                value={speech.rate}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                isDisabled={
                  !selectedVoice ||
                  speech.state.tag === 'starting' ||
                  speech.state.tag === 'speaking'
                }
                onPress={() => speech.play('This is a test of the selected system voice.')}
                size="sm"
                variant="secondary"
              >
                Test voice
              </Button>
              {speech.state.tag === 'error' && (
                <span className="text-xs text-rose-300" role="alert">
                  Voice playback is unavailable.
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      <ProviderResponseTest provider={savedProvider} />

      <Card className="border border-white/[0.08] bg-[#161619] p-5">
        <h2 className="text-base font-semibold text-zinc-100">Privacy</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Speech is transcribed locally and learning data is stored in local SQLite. When you
          request an AI reply, the app sends the transcript and prompt context needed for that
          request to your configured provider. Raw audio is held temporarily and discarded after
          successful transcription. Microphone access is requested when you start recording.
        </p>
      </Card>
    </div>
  );
}
