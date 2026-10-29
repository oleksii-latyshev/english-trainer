import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { useContext } from 'react';
import { createPlayback } from '@/core/speech';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { exerciseKey } from '../../helpers/exercise-key';
import {
  cancelSpoken,
  retrySpokenTranscription,
  spokenViewAtom,
  startSpoken,
  stopSpoken,
} from '../../model/spoken';
import type { SpokenView } from '../../types';

type Props = {
  runId: number;
  position: number;
  question: string;
  blockedReason: string | null;
  isSaving: boolean;
};

const PROGRESS: Partial<Record<SpokenView['tag'], string>> = {
  requesting: 'Waiting for the microphone…',
  transcribing: 'Transcribing locally…',
  saving: 'Saving your answer…',
};

function Status({ view }: { view: SpokenView }) {
  if (view.tag === 'failed') {
    return (
      <Notice className="rounded-control max-w-xl border" role="alert" tone="warn">
        {view.message}
      </Notice>
    );
  }
  if (view.tag === 'recording') {
    return (
      <span className="text-muted min-h-6" role="status">
        {view.liveText || 'Recording. Answer aloud, then stop.'}
      </span>
    );
  }
  const progress = PROGRESS[view.tag];
  return progress ? (
    <span className="text-muted" role="status">
      {progress}
    </span>
  ) : null;
}

export function SpokenAnswer({ runId, position, question, blockedReason, isSaving }: Props) {
  const registry = useContext(RegistryContext);
  const view = useAtomValue(spokenViewAtom(exerciseKey(runId, position)));
  const isRecording = view.tag === 'requesting' || view.tag === 'recording';
  const isWorking = isRecording || view.tag === 'transcribing' || view.tag === 'saving';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => createPlayback(registry).play(question)} tone="secondary">
          <Volume2 aria-hidden="true" />
          Hear the question
        </Button>
        {isRecording ? (
          <Button
            disabled={view.tag === 'requesting'}
            onClick={() => stopSpoken(registry)}
            tone="primary"
          >
            <Square aria-hidden="true" fill="currentColor" />
            Stop recording
          </Button>
        ) : (
          <Button
            disabled={blockedReason !== null || view.tag === 'busy' || isWorking || isSaving}
            onClick={() => startSpoken(registry, { runId, position })}
            tone="primary"
          >
            <Mic aria-hidden="true" />
            Record answer
          </Button>
        )}
        {(isWorking || view.tag === 'failed') && view.tag !== 'saving' && (
          <Button onClick={() => cancelSpoken(registry)} tone="quiet">
            Cancel
          </Button>
        )}
        {view.tag === 'failed' && view.canRetryTranscription && (
          <Button onClick={() => retrySpokenTranscription(registry)} tone="secondary">
            Retry transcription
          </Button>
        )}
      </div>
      <Status view={view} />
      {blockedReason && <p className="text-faint m-0 text-xs">{blockedReason}</p>}
    </div>
  );
}
