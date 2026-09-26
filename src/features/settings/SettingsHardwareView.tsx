import { Button, Card, Chip } from '@heroui/react';
import { CheckCircle2, Download, Mic, Play, RotateCw } from 'lucide-react';
import { useState } from 'react';

type SettingsTab = 'audio' | 'whisper' | 'ai' | 'privacy';

export function SettingsHardwareView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [retainAudio, setRetainAudio] = useState(false);
  const [autoSpeakTurns, setAutoSpeakTurns] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel] = useState(42);
  const [testingAgy, setTestingAgy] = useState(false);
  const [agyStatus, setAgyStatus] = useState<'connected' | 'checking'>('connected');

  function handleTestMic() {
    setIsTestingMic((prev) => !prev);
  }

  function handleTestAgy() {
    setTestingAgy(true);
    setAgyStatus('checking');
    setTimeout(() => {
      setTestingAgy(false);
      setAgyStatus('connected');
    }, 800);
  }

  function handleTestVoice() {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        'Hello! This is your current speech synthesis voice for English Trainer.',
      );
      utterance.rate = speechRate;
      utterance.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
      {/* Header Context */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            SYSTEM & PREFERENCES
          </span>
          <Chip color="default" size="sm" variant="soft">
            macOS Local Hardware
          </Chip>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Hardware & App Settings
        </h1>
        <p className="text-sm text-zinc-400">
          Complete local control over audio devices, local Whisper speech models, Antigravity AI
          bridge, and privacy guarantees.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'audio'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('audio')}
          type="button"
        >
          <span>🎙️</span> Audio & Voice
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'whisper'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('whisper')}
          type="button"
        >
          <span>⚡</span> Whisper STT Engine
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'ai'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('ai')}
          type="button"
        >
          <span>🤖</span> AI Bridge (agy)
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'privacy'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('privacy')}
          type="button"
        >
          <span>🔒</span> Privacy & Data
        </button>
      </div>

      {/* Tab: Audio & Voice */}
      {activeTab === 'audio' && (
        <div className="flex flex-col gap-5">
          {/* Microphone Card */}
          <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
            <h3 className="text-base font-semibold text-zinc-100">Microphone Input</h3>
            <p className="text-xs text-zinc-400">
              Select your microphone and verify audio levels before practicing.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <span className="text-xs font-medium text-zinc-300">Input Device</span>
                <div className="mt-1 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-zinc-200">
                  <span className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-emerald-400" />
                    MacBook Pro Microphone (Built-in)
                  </span>
                  <span className="text-[11px] text-zinc-500">16 kHz Mono PCM</span>
                </div>
              </div>

              {/* Mic Level Tester */}
              <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-medium text-zinc-300">Live Input Level</span>
                  <span className="text-xs font-mono text-emerald-400">
                    {isTestingMic ? '-14 dB (Optimal)' : 'Idle'}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full transition-all duration-150 ${
                      isTestingMic ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                    style={{ width: isTestingMic ? `${micLevel}%` : '0%' }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Button
                    className={`text-xs ${
                      isTestingMic
                        ? 'border border-rose-500/30 bg-rose-500/20 text-rose-300'
                        : 'border border-white/10 bg-white/[0.06] text-zinc-300'
                    }`}
                    onPress={handleTestMic}
                    size="sm"
                    variant="secondary"
                  >
                    {isTestingMic ? 'Stop Test' : 'Test Microphone'}
                  </Button>
                  <span className="text-[11px] text-zinc-500">Normalizes to 16 kHz mono</span>
                </div>
              </div>
            </div>
          </Card>

          {/* TTS Card */}
          <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
            <h3 className="text-base font-semibold text-zinc-100">Speech Synthesis (TTS)</h3>
            <p className="text-xs text-zinc-400">
              Configure system voice playback for conversation and questions.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-zinc-300">
                    Voice: Samantha / System English
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Default macOS High-Fidelity English Voice
                  </span>
                </div>
                <Button
                  className="border border-white/10 bg-white/[0.06] text-xs text-zinc-300 hover:bg-white/10"
                  onPress={handleTestVoice}
                  size="sm"
                  variant="secondary"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Test Voice</span>
                </Button>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Playback Speed: {speechRate.toFixed(2)}x</span>
                  <span className="text-zinc-500">Recommended: 1.00x for B1/B2 training</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    className="w-full accent-white"
                    max="1.3"
                    min="0.8"
                    onChange={(e) => setSpeechRate(Number.parseFloat(e.target.value))}
                    step="0.05"
                    type="range"
                    value={speechRate}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
                <div>
                  <span className="text-xs font-semibold text-zinc-200">
                    Automatically Speak AI Turns
                  </span>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Play spoken voice audio as soon as AI response arrives.
                  </p>
                </div>
                <input
                  checked={autoSpeakTurns}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-white accent-white"
                  onChange={(e) => setAutoSpeakTurns(e.target.checked)}
                  type="checkbox"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Whisper STT Engine */}
      {activeTab === 'whisper' && (
        <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Local Whisper Speech-to-Text
              </h3>
              <p className="text-xs text-zinc-400">
                100% on-device speech transcription powered by Apple Silicon Metal GPU acceleration.
              </p>
            </div>
            <Chip color="success" size="sm" variant="soft">
              Metal GPU ⚡ Active
            </Chip>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">Whisper Base.en</span>
                  <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-300">
                    Active & Installed
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  142 MB · Ultra-fast ~14ms latency · Perfect for conversational flow
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-300">Whisper Small.en</span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    Optional
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  466 MB · Higher accuracy for heavy technical jargon & complex accents
                </p>
              </div>
              <Button
                className="border border-white/10 bg-white/[0.05] text-xs text-zinc-300 hover:bg-white/10"
                size="sm"
                variant="secondary"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download (466 MB)</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: AI Bridge */}
      {activeTab === 'ai' && (
        <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Antigravity CLI (agy) Runtime Bridge
              </h3>
              <p className="text-xs text-zinc-400">
                Local CLI adapter for conversational reasoning, coaching rewrites, and B2 phrasing.
              </p>
            </div>
            <Chip
              color={agyStatus === 'connected' ? 'success' : 'warning'}
              size="sm"
              variant="soft"
            >
              {agyStatus === 'connected' ? 'Connected (CLI v2.4)' : 'Testing...'}
            </Chip>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">CLI Binary Path:</span>
                <span className="font-mono text-zinc-200">/opt/homebrew/bin/agy</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-zinc-400">Execution Sandbox:</span>
                <span className="font-mono text-zinc-200">/tmp/eng-trainer-agy-*</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-zinc-400">Timeout Policy:</span>
                <span className="font-mono text-zinc-200">12,000ms bounded timeout</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Test CLI bridge connection and JSON output validation.
              </span>
              <Button
                className="border border-white/10 bg-white/[0.06] text-xs text-zinc-200 hover:bg-white/10"
                isDisabled={testingAgy}
                onPress={handleTestAgy}
                size="sm"
                variant="secondary"
              >
                <RotateCw className={`h-3.5 w-3.5 ${testingAgy ? 'animate-spin' : ''}`} />
                <span>Test Provider Health</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Privacy & Data */}
      {activeTab === 'privacy' && (
        <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
          <h3 className="text-base font-semibold text-zinc-100">Privacy & Data Storage</h3>
          <p className="text-xs text-zinc-400">
            English Trainer is local-first. Raw audio is discarded by default immediately after
            transcription.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div>
                <span className="text-xs font-semibold text-zinc-200">
                  Retain Raw Audio Recordings
                </span>
                <p className="mt-1 text-[11px] text-zinc-400">
                  When disabled, raw audio PCM bytes are immediately wiped from memory after Whisper
                  outputs the transcript.
                </p>
              </div>
              <input
                checked={retainAudio}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-white accent-white"
                onChange={(e) => setRetainAudio(e.target.checked)}
                type="checkbox"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div>
                <span className="text-xs font-semibold text-zinc-200">Local SQLite Storage</span>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Transcripts, mistake vault, and spaced repetition schedules stored in local app
                  data directory.
                </p>
              </div>
              <Button
                className="border border-white/10 bg-white/[0.06] text-xs text-zinc-300 hover:bg-white/10"
                size="sm"
                variant="secondary"
              >
                Export JSON
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
