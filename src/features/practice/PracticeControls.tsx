import { Button } from '@heroui/react';
import type { TranscriptionRecovery } from '@/features/speech/transcriptionRecovery';
import type { RecordingStatus } from '@/features/speech/useSpeechCapture';
import { type PracticeState, sessionDetails } from './lib/practiceState';
import { practicePromptSequence } from './lib/practiceViewState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { ScaffoldingPanel } from './ScaffoldingPanel';
import { SessionProgress } from './SessionProgress';

function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function recordingLabel(status: RecordingStatus, elapsedMs: number, durationMs: number): string {
  switch (status) {
    case 'requesting':
      return 'Waiting for microphone permission…';
    case 'recording':
      return `Recording · ${formatDuration(elapsedMs)}`;
    case 'stopping':
      return 'Finishing recording…';
    case 'ready':
      return `Ready to listen · ${formatDuration(durationMs)}`;
    case 'error':
      return 'Ready to try again';
    default:
      return 'Microphone ready when you are';
  }
}

function transcribeButtonLabel(
  transcribing: boolean,
  failure: TranscriptionRecovery | undefined,
): string {
  if (transcribing) return 'Transcribing locally…';
  if (failure?.kind === 'setup') return 'Retry after setup';
  return failure ? 'Retry transcription' : 'Transcribe';
}

function recordButtonLabel(
  status: RecordingStatus,
  hasTranscript: boolean,
  isRetrying: boolean,
): string {
  if (isRetrying) {
    if (status === 'error') return 'Try recording retry again';
    if (status === 'ready' || hasTranscript) return 'Record retry again';
    return 'Start re-speaking';
  }
  if (status === 'error') return 'Try recording again';
  if (status === 'ready' || hasTranscript) return 'Record again';
  return 'Start recording';
}

function startSessionLabel(practice: PracticeState): string {
  if (practice.tag === 'loading') return 'Restoring conversation…';
  if (practice.tag === 'starting') return 'Starting conversation…';
  return 'Start daily practice';
}

function promptKicker(
  recallActive: boolean,
  surface: 'conversation' | 'coach',
  isRetrying: boolean,
): string {
  if (isRetrying) return 'RE-SPEAKING / ATTEMPT 2';
  if (surface === 'coach') return 'COACH PROMPT';
  return recallActive ? 'PHRASE RECALL CUE' : 'TODAY’S PROMPT';
}

function promptIndex(
  session: ReturnType<typeof sessionDetails>,
  recallActive: boolean,
  isRetrying: boolean,
): string {
  if (isRetrying) return 'RETRY';
  if (recallActive) return 'RECALL';
  const sequence = practicePromptSequence(session);
  return sequence === undefined ? '01 / 01' : `TURN ${sequence}`;
}

function isConversationOpen(practice: PracticeState): boolean {
  return practice.tag === 'active' || practice.tag === 'waiting';
}

function SessionAction({
  model,
  actions,
  recallActive,
}: {
  model: PracticeViewModel;
  actions: PracticeActions;
  recallActive: boolean;
}) {
  const { practice, busy, status, transcribing } = model;
  const { startPractice, finishPractice } = actions;
  const isDisabled =
    busy || status === 'recording' || transcribing || practice.tag === 'waiting' || recallActive;
  if (practice.tag === 'idle' || practice.tag === 'loading' || practice.tag === 'starting') {
    return (
      <Button
        className="secondary-action"
        isDisabled={isDisabled}
        onPress={() => startPractice()}
        variant="secondary"
      >
        {startSessionLabel(practice)}
      </Button>
    );
  }
  return (
    <Button
      className="secondary-action"
      isDisabled={isDisabled}
      onPress={finishPractice}
      variant="secondary"
    >
      {practice.tag === 'finishing' ? 'Finishing…' : 'Finish practice'}
    </Button>
  );
}

function resolveQuestion(
  session: ReturnType<typeof sessionDetails>,
  isRetrying: boolean,
  retryPrompt?: string,
  recallActive?: boolean,
  recallCue?: string,
): string {
  if (isRetrying) return retryPrompt ?? 'Speak your corrected answer now.';
  if (recallActive) return recallCue ?? 'Review your saved recall below.';
  return session?.question ?? 'What was the most interesting part of your day?';
}

function VoiceRecorderHud({
  status,
  elapsedMs,
  durationMs,
  isRetrying,
  hasTranscript,
  busy,
  transcribing,
  isWaiting,
  recallLocked,
  playbackUrl,
  transcriptionFailure,
  onStartRecording,
  onStopRecording,
  onTranscribe,
}: {
  status: RecordingStatus;
  elapsedMs: number;
  durationMs: number;
  isRetrying: boolean;
  hasTranscript: boolean;
  busy: boolean;
  transcribing: boolean;
  isWaiting: boolean;
  recallLocked: boolean;
  playbackUrl?: string;
  transcriptionFailure?: TranscriptionRecovery;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTranscribe: () => void;
}) {
  const isRecording = status === 'recording';
  return (
    <div
      className={`voice-recorder-hud ${isRecording ? 'voice-recorder-hud--recording' : ''}`}
      aria-live="polite"
    >
      <div className="hud-left">
        <div className="hud-mic-capsule" aria-hidden="true">
          <span className="text-base">{isRecording ? '■' : '🎤'}</span>
        </div>
        <div className="hud-text">
          <p className="hud-status-title">{recordingLabel(status, elapsedMs, durationMs)}</p>
          <p className="hud-status-sub">
            {isRecording
              ? 'Speak clearly into your microphone · Click stop when finished'
              : 'Hold Space to talk, or click the button on the right'}
          </p>
        </div>
      </div>

      <div className="hud-actions">
        {isRecording ? (
          <Button
            className="primary-action !bg-rose-500 !text-white hover:!bg-rose-600"
            onPress={onStopRecording}
          >
            Stop recording
          </Button>
        ) : (
          <Button
            className="primary-action"
            isDisabled={busy || transcribing || isWaiting || recallLocked}
            onPress={onStartRecording}
          >
            {recordButtonLabel(status, hasTranscript, isRetrying)}
          </Button>
        )}
        {playbackUrl && (
          <Button className="secondary-action" isDisabled={transcribing} onPress={onTranscribe}>
            {transcribeButtonLabel(transcribing, transcriptionFailure)}
          </Button>
        )}
      </div>
    </div>
  );
}

export function PracticeControls({
  model,
  actions,
  recallCue,
  recallActive = false,
  recallLocked = false,
  recallCompletedCount = 0,
  surface = 'conversation',
  isRetrying = false,
  retryPrompt,
}: {
  model: PracticeViewModel;
  actions: PracticeActions;
  recallCue?: string;
  recallActive?: boolean;
  recallLocked?: boolean;
  recallCompletedCount?: number;
  surface?: 'conversation' | 'coach';
  isRetrying?: boolean;
  retryPrompt?: string;
}) {
  const {
    status,
    error,
    elapsedMs,
    durationMs,
    playbackUrl,
    transcript,
    transcriptionFailure,
    transcribing,
    practice,
    practiceError,
    busy,
  } = model;
  const { startRecording, stopRecording, transcribeRecording } = actions;
  const session = sessionDetails(practice);
  const conversationOpen = isConversationOpen(practice);
  const question = resolveQuestion(session, isRetrying, retryPrompt, recallActive, recallCue);

  return (
    <div className="prompt-card">
      <div className="prompt-card-header">
        <div>
          <p className="section-kicker">{promptKicker(recallActive, surface, isRetrying)}</p>
          <h2 className="prompt-title">{question}</h2>
        </div>
        <span className="prompt-index">{promptIndex(session, recallActive, isRetrying)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/5 py-3">
        <div className="flex items-center gap-3">
          <SessionAction actions={actions} model={model} recallActive={recallActive} />
          {conversationOpen && (
            <span className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Session in progress · Saved locally
            </span>
          )}
        </div>
      </div>

      {session && (
        <SessionProgress
          session={session}
          recallActive={recallActive}
          recallCompletedCount={recallCompletedCount}
        />
      )}

      {practiceError && (
        <p className="error-message" role="alert">
          {practiceError}
        </p>
      )}

      {!recallActive && !isRetrying && <ScaffoldingPanel question={question} />}

      <VoiceRecorderHud
        busy={busy}
        durationMs={durationMs}
        elapsedMs={elapsedMs}
        hasTranscript={Boolean(transcript)}
        isRetrying={isRetrying}
        isWaiting={
          practice.tag === 'waiting' ||
          (surface === 'coach' && session?.coachState?.is_pending === true)
        }
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onTranscribe={transcribeRecording}
        playbackUrl={playbackUrl}
        recallLocked={recallLocked}
        status={status}
        transcribing={transcribing}
        transcriptionFailure={transcriptionFailure}
      />

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {transcriptionFailure && (
        <p className="error-message" role="alert">
          {transcriptionFailure.message}
        </p>
      )}

      {playbackUrl && (
        <div className="recording-preview flex flex-col gap-2 rounded-xl border border-white/5 bg-black/20 p-3">
          <label className="text-xs text-zinc-400" htmlFor={`${surface}-recording-playback`}>
            Review audio take before transcription
          </label>
          {/* biome-ignore lint/a11y/useMediaCaption: A timed caption is unavailable before transcription. */}
          <audio
            className="w-full h-8"
            controls
            id={`${surface}-recording-playback`}
            src={playbackUrl}
          />
        </div>
      )}
    </div>
  );
}
