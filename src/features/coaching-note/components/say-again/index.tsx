import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { Check, Mic, Square } from 'lucide-react';
import { type ReactNode, useContext } from 'react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { answerKey } from '../../helpers/answer-key';
import { secondTryHint, usedImprovedWording } from '../../helpers/second-try';
import { sayAgainEffectsAtom, sayAgainViewAtom, secondTryAtom } from '../../model/atoms';
import {
  cancelSayAgain,
  retryTranscription,
  startSayAgain,
  stopSayAgain,
} from '../../model/controls';
import type { AnswerTarget, AttemptComparison, SayAgainView } from '../../types';

type Props = {
  target: AnswerTarget;
  trailing?: ReactNode;
};

function Comparison({ comparison }: { comparison: AttemptComparison }) {
  const hint = secondTryHint(comparison);
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line border-dashed px-3.5 py-3">
      <span className="text-caption text-faint">Second try</span>
      <p className="m-0 text-body text-foreground" data-word-lookup>
        {comparison.retry_transcript}
      </p>
      {usedImprovedWording(comparison) && (
        <span className="inline-flex items-center gap-1.5 text-caption text-ok">
          <Check aria-hidden="true" className="size-3.5" />
          You used “{comparison.target}”
        </span>
      )}
      {hint && <span className="text-caption text-faint">{hint}</span>}
    </div>
  );
}

const PROGRESS: Partial<Record<SayAgainView['tag'], string>> = {
  requesting: 'Waiting for the microphone…',
  capturing: 'Recording. Say the better version, then stop.',
  transcribing: 'Transcribing locally…',
  comparing: 'Comparing the two tries…',
};

function Status({ view }: { view: SayAgainView }) {
  if (view.tag === 'failed') {
    return (
      <Notice className="rounded-control border" role="alert" tone="warn">
        {view.message}
      </Notice>
    );
  }
  const progress = PROGRESS[view.tag];
  if (progress === undefined) return null;
  return (
    <span className="text-caption text-muted" role="status">
      {progress}
    </span>
  );
}

export function SayAgain({ target, trailing }: Props) {
  useAtomMount(sayAgainEffectsAtom);
  const registry = useContext(RegistryContext);
  const key = answerKey(target);
  const view = useAtomValue(sayAgainViewAtom(key));
  const comparison = useAtomValue(secondTryAtom(key));
  const isRecording = view.tag === 'requesting' || view.tag === 'capturing';
  const isWorking = isRecording || view.tag === 'transcribing' || view.tag === 'comparing';

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {isRecording ? (
          <Button
            disabled={view.tag === 'requesting'}
            onClick={() => stopSayAgain(registry)}
            size="sm"
            tone="primary"
          >
            <Square aria-hidden="true" fill="currentColor" />
            Stop recording
          </Button>
        ) : (
          <Button
            disabled={view.tag === 'busy' || isWorking}
            onClick={() => startSayAgain(registry, target)}
            size="sm"
            tone="secondary"
          >
            <Mic aria-hidden="true" />
            Say it again
          </Button>
        )}
        {(isWorking || view.tag === 'failed') && (
          <Button onClick={() => cancelSayAgain(registry)} size="sm" tone="quiet">
            Cancel
          </Button>
        )}
        {view.tag === 'failed' && view.canRetryTranscription && (
          <Button onClick={() => retryTranscription(registry)} size="sm" tone="secondary">
            Retry transcription
          </Button>
        )}
        {trailing}
      </div>
      <Status view={view} />
      {comparison && !isWorking && <Comparison comparison={comparison} />}
    </div>
  );
}
