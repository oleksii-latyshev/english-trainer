import { Button, Card } from '@heroui/react';
import type { TranscriptionRecovery } from '@/features/speech/transcriptionRecovery';
import type { RecordingStatus } from '@/features/speech/useSpeechCapture';
import { type PracticeState, sessionDetails } from './lib/practiceState';
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
  return session ? `TURN ${session.turnCount + 1}` : '01 / 01';
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
        onPress={startPractice}
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
  const question = isRetrying
    ? (retryPrompt ?? 'Speak your corrected answer now.')
    : recallActive
      ? (recallCue ?? 'Review your saved recall below.')
      : (session?.question ?? 'What was the most interesting part of your day?');
  return (
    <Card className="panel practice-panel" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">{promptKicker(recallActive, surface, isRetrying)}</p>
          <Card.Title className="prompt-title">{question}</Card.Title>
        </div>
        <span className="prompt-index">{promptIndex(session, recallActive, isRetrying)}</span>
      </Card.Header>
      <Card.Content className="panel-content">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <SessionAction actions={actions} model={model} recallActive={recallActive} />
          {conversationOpen && (
            <span className="text-sm text-teal-200">Conversation in progress</span>
          )}
        </div>
        {conversationOpen && (
          <p className="mt-0 mb-4 text-xs text-slate-400">
            This conversation is saved locally. You can resume it after restarting the app.
          </p>
        )}
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
        <div className={`recorder-state recorder-state--${status}`} aria-live="polite">
          <div className="mic-orb" aria-hidden="true">
            <span className="mic-symbol">●</span>
          </div>
          <span className="recorder-copy">{recordingLabel(status, elapsedMs, durationMs)}</span>
        </div>
        <div className="controls flex flex-wrap gap-3">
          {status === 'recording' ? (
            <Button className="primary-action" onPress={stopRecording} variant="danger">
              Stop recording
            </Button>
          ) : (
            <Button
              className="primary-action"
              isDisabled={busy || transcribing || practice.tag === 'waiting' || recallLocked}
              onPress={startRecording}
              variant="primary"
            >
              {recordButtonLabel(status, Boolean(transcript), isRetrying)}
            </Button>
          )}
          {playbackUrl && (
            <Button
              className="secondary-action"
              isDisabled={transcribing}
              onPress={transcribeRecording}
              variant="secondary"
            >
              {transcribeButtonLabel(transcribing, transcriptionFailure)}
            </Button>
          )}
        </div>
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
          <div className="recording-preview">
            <label htmlFor={`${surface}-recording-playback`}>
              Review your recording before transcription
            </label>
            {/* biome-ignore lint/a11y/useMediaCaption: A timed caption is unavailable before transcription. */}
            <audio controls id={`${surface}-recording-playback`} src={playbackUrl} />
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
