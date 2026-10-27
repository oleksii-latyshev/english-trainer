import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { Mic, Square } from 'lucide-react';
import { useContext } from 'react';
import { isSessionBusyAtom } from '@/core/practice-session';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { RecordButton } from '@/shared/ui/record-button';
import {
  recordButtonLabel,
  recordingLabel,
  transcribeButtonLabel,
} from '../../helpers/recorder-labels';
import { recallRecorderAtom } from '../../model/atoms';
import {
  retryRecallTranscription,
  startRecallRecording,
  stopRecallRecording,
} from '../../model/controls';

type Props = {
  cue: string;
  isLocked: boolean;
};

const PLAYBACK_ID = 'recall-recording-playback';
const KICKER = 'Phrase recall cue';

export function RecallRecorder({ cue, isLocked }: Props) {
  const registry = useContext(RegistryContext);
  const recorder = useAtomValue(recallRecorderAtom);
  const isSessionBusy = useAtomValue(isSessionBusyAtom);
  const isRecording = recorder.status === 'recording';
  const isBusy =
    isSessionBusy ||
    recorder.status === 'requesting' ||
    recorder.status === 'stopping' ||
    recorder.isTranscribing;
  const name = isRecording
    ? 'Stop recording'
    : recordButtonLabel(recorder.status, recorder.transcript !== '');

  return (
    <section
      aria-label={KICKER}
      className="border-line bg-surface flex flex-col gap-2.5 rounded-2xl border px-4 py-3.5"
    >
      <div className="text-accent text-xs font-semibold tracking-wide">{KICKER}</div>
      <p className="m-0 text-[16px] leading-snug font-semibold">{cue}</p>
      <div className="flex items-center gap-4">
        <RecordButton
          aria-label={name}
          disabled={!isRecording && (isBusy || isLocked)}
          onClick={() =>
            isRecording ? stopRecallRecording(registry) : startRecallRecording(registry)
          }
          state={isRecording ? 'live' : 'ready'}
        >
          {isRecording ? (
            <Square aria-hidden="true" fill="currentColor" />
          ) : (
            <Mic aria-hidden="true" />
          )}
        </RecordButton>
        <div aria-live="polite" className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body font-semibold">
            {recordingLabel(recorder.status, recorder.elapsedMs, recorder.durationMs)}
          </span>
          <span className="text-caption text-muted">
            {isRecording
              ? 'Speak clearly, then press stop when finished'
              : 'Press the microphone to record'}
          </span>
        </div>
        {recorder.playbackUrl && (
          <Button
            disabled={recorder.isTranscribing}
            onClick={() => retryRecallTranscription(registry)}
            size="sm"
            tone="secondary"
          >
            {transcribeButtonLabel(recorder.isTranscribing, recorder.failure)}
          </Button>
        )}
      </div>
      {recorder.error && (
        <Notice className="rounded-control border" role="alert" tone="warn">
          {recorder.error}
        </Notice>
      )}
      {recorder.failure && (
        <Notice className="rounded-control border" role="alert" tone="warn">
          {recorder.failure.message}
        </Notice>
      )}
      {recorder.playbackUrl && (
        <div className="flex flex-col gap-2.5">
          <label className="text-faint text-xs" htmlFor={PLAYBACK_ID}>
            Review audio take before transcription
          </label>
          {/* biome-ignore lint/a11y/useMediaCaption: A timed caption is unavailable before transcription. */}
          <audio className="h-8 w-full" controls id={PLAYBACK_ID} src={recorder.playbackUrl} />
        </div>
      )}
    </section>
  );
}
