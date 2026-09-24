import { Button, Card } from '@heroui/react';
import { FollowUpPanel } from '@/features/conversation/FollowUpPanel';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { type SpeechTiming, TimingPanel } from '@/features/speech/TimingPanel';
import type { TranscriptionRecovery } from '@/features/speech/transcriptionRecovery';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { ConversationTurn } from '@/lib/types';

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

export type PracticeState =
  | { tag: 'idle' }
  | { tag: 'starting' }
  | { tag: 'active'; sessionId: number; question: string; turnCount: number }
  | { tag: 'finishing'; sessionId: number; question: string; turnCount: number };

type Props = {
  model: {
    status: RecordingStatus;
    error: string;
    elapsedMs: number;
    durationMs: number;
    playbackUrl?: string;
    transcript?: string;
    transcriptionFailure?: TranscriptionRecovery;
    transcribing: boolean;
    timing: SpeechTiming;
    practice: PracticeState;
    practiceError: string;
    busy: boolean;
    turnPending: boolean;
    currentRequestId: number;
  };
  actions: {
    startRecording: () => void;
    stopRecording: () => void;
    transcribeRecording: () => void;
    startPractice: () => void;
    finishPractice: () => void;
    handlePracticeTurn: (sessionId: number, turn: ConversationTurn) => void;
    isCurrent: () => boolean;
    onTurnPendingChange: (isPending: boolean) => void;
  };
  speech: ReturnType<typeof useSystemSpeech>;
};

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

function recordButtonLabel(status: RecordingStatus, hasTranscript: boolean): string {
  if (status === 'error') return 'Try recording again';
  if (status === 'ready' || hasTranscript) return 'Record again';
  return 'Start recording';
}

function SessionAction({ model, actions }: Pick<Props, 'model' | 'actions'>) {
  const { practice, busy, status, transcribing, turnPending } = model;
  const { startPractice, finishPractice } = actions;
  const isDisabled = busy || status === 'recording' || transcribing || turnPending;
  if (practice.tag === 'idle' || practice.tag === 'starting') {
    return (
      <Button
        className="secondary-action"
        isDisabled={isDisabled}
        onPress={startPractice}
        variant="secondary"
      >
        {practice.tag === 'starting' ? 'Starting conversation…' : 'Start conversation'}
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
      {practice.tag === 'finishing' ? 'Ending…' : 'End conversation'}
    </Button>
  );
}

function PracticeControls({ model, actions }: Pick<Props, 'model' | 'actions'>) {
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
    turnPending,
  } = model;
  const { startRecording, stopRecording, transcribeRecording } = actions;
  return (
    <Card className="panel practice-panel" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">TODAY’S PROMPT</p>
          <Card.Title className="prompt-title">
            {practice.tag === 'active' || practice.tag === 'finishing'
              ? practice.question
              : 'What was the most interesting part of your day?'}
          </Card.Title>
        </div>
        <span className="prompt-index">
          {practice.tag === 'active' || practice.tag === 'finishing'
            ? `TURN ${practice.turnCount + 1}`
            : '01 / 01'}
        </span>
      </Card.Header>
      <Card.Content className="panel-content">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <SessionAction actions={actions} model={model} />
          {practice.tag === 'active' && (
            <span className="text-sm text-teal-200">Conversation in progress</span>
          )}
        </div>
        {practice.tag === 'active' && (
          <p className="mt-0 mb-4 text-xs text-slate-400">
            This conversation stays in memory until you end it or close the app.
          </p>
        )}
        {practiceError && (
          <p className="error-message" role="alert">
            {practiceError}
          </p>
        )}
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
              isDisabled={busy || turnPending}
              onPress={startRecording}
              variant="primary"
            >
              {recordButtonLabel(status, Boolean(transcript))}
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
            <label htmlFor="recording-playback">Review your recording before transcription</label>
            {/* biome-ignore lint/a11y/useMediaCaption: A timed caption is unavailable before transcription. */}
            <audio controls id="recording-playback" src={playbackUrl} />
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

export function PracticeView({ model, actions, speech }: Props) {
  const { transcript, timing, practice, currentRequestId } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange } = actions;
  return (
    <main className="app-shell min-h-screen text-slate-100">
      <div className="app-frame mx-auto w-full max-w-6xl">
        <header className="app-header flex items-center justify-between gap-4">
          <div className="brand flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true">
              ✦
            </span>
            <span>English Trainer</span>
          </div>
          <span className="header-pill">LOCAL SPEECH LAB</span>
        </header>

        <div className="content-grid grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <section aria-labelledby="practice-title" className="min-w-0">
            <p className="eyebrow">PRACTICE / SPEAKING</p>
            <h1 id="practice-title">Your voice, in English.</h1>
            <p className="intro">
              {practice.tag === 'active'
                ? 'Answer Eva’s question aloud, then send your local transcript to continue.'
                : 'Take a moment to answer the prompt. We’ll transcribe your words locally, then read them back so you can hear the phrasing.'}
            </p>

            <PracticeControls model={model} actions={actions} />

            <Card className="panel transcript-panel" variant="secondary">
              <Card.Header className="panel-header">
                <div>
                  <p className="section-kicker">YOUR WORDS</p>
                  <Card.Title className="section-title">Transcript</Card.Title>
                </div>
                <span className={`result-indicator ${transcript ? 'result-indicator--ready' : ''}`}>
                  {transcript ? 'READY' : 'WAITING'}
                </span>
              </Card.Header>
              <Card.Content className="panel-content">
                {transcript ? (
                  <p className="transcript-text" aria-live="polite">
                    “{transcript}”
                  </p>
                ) : (
                  <p className="empty-transcript">
                    Your transcript will appear here after you record and transcribe a short answer.
                  </p>
                )}
              </Card.Content>
            </Card>
            {transcript && (
              <FollowUpPanel
                isCurrent={isCurrent}
                key={currentRequestId}
                onPendingChange={practice.tag === 'active' ? onTurnPendingChange : undefined}
                onTurn={
                  practice.tag === 'active'
                    ? (turn) => handlePracticeTurn(practice.sessionId, turn)
                    : undefined
                }
                sessionId={
                  practice.tag === 'active' || practice.tag === 'finishing'
                    ? practice.sessionId
                    : undefined
                }
                speak={speech.play}
                transcript={transcript}
              />
            )}
            <TimingPanel timing={timing} />
          </section>

          <SpeechPanel speech={speech} transcript={transcript} />
        </div>
      </div>
    </main>
  );
}
