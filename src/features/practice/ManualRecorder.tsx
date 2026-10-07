import { Button } from '@heroui/react';
import { MicButton } from '@/components/MicControl';
import type { TranscriptionRecovery } from '@/features/speech/transcriptionRecovery';
import type { RecordingStatus } from '@/features/speech/useSpeechCapture';
import { sessionDetails } from './lib/practiceState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { TurnNotice } from './TurnNotice';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  /** Small label above the cue, e.g. "Phrase recall cue". */
  kicker: string;
  /** What to say: a recall cue or the stronger version to re-speak. */
  cue: string;
  surface: 'recall' | 'retry';
  isRetrying?: boolean;
  /** Recording is locked while an attempt is being saved or shown. */
  isLocked?: boolean;
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

/** Manual record, stop and transcribe for the surfaces that do not use the voice-first composer. */
export function ManualRecorder({
  model,
  actions,
  kicker,
  cue,
  surface,
  isRetrying = false,
  isLocked = false,
}: Props) {
  const { status, error, elapsedMs, durationMs, playbackUrl, transcript, transcribing } = model;
  const isRecording = status === 'recording';
  // A saved Coach answer waits for Continue, so the retry take is started for the learner instead.
  const isWaiting =
    model.practice.tag === 'waiting' ||
    (surface === 'retry' && sessionDetails(model.practice)?.coachState?.is_pending === true);
  const failure = model.transcriptionFailure;
  const playbackId = `${surface}-recording-playback`;

  return (
    <section aria-label={kicker} className="talk-card">
      <div className="talk-card-label" data-tone="accent">
        {kicker}
      </div>
      <p className="talk-recorder-cue">{cue}</p>
      <div className="talk-recorder">
        <MicButton
          icon={isRecording ? 'stop' : 'mic'}
          isDisabled={!isRecording && (model.busy || transcribing || isWaiting || isLocked)}
          name={
            isRecording
              ? 'Stop recording'
              : recordButtonLabel(status, Boolean(transcript), isRetrying)
          }
          onPress={isRecording ? actions.stopRecording : actions.startRecording}
          variant={isRecording ? 'live' : 'ready'}
        />
        <div aria-live="polite" className="talk-recorder-copy">
          <span className="talk-mic-title">{recordingLabel(status, elapsedMs, durationMs)}</span>
          <span className="talk-mic-hint">
            {isRecording
              ? 'Speak clearly, then press stop when finished'
              : 'Press the microphone to record'}
          </span>
        </div>
        {playbackUrl && (
          <Button
            isDisabled={transcribing}
            onPress={actions.transcribeRecording}
            size="sm"
            variant="secondary"
          >
            {transcribeButtonLabel(transcribing, failure)}
          </Button>
        )}
      </div>
      {error && <TurnNotice message={error} />}
      {failure && <TurnNotice message={failure.message} />}
      {playbackUrl && (
        <div className="talk-help-group">
          <label className="talk-help-caption" htmlFor={playbackId}>
            Review audio take before transcription
          </label>
          {/* biome-ignore lint/a11y/useMediaCaption: A timed caption is unavailable before transcription. */}
          <audio controls id={playbackId} src={playbackUrl} />
        </div>
      )}
    </section>
  );
}
