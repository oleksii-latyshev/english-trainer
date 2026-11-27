import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { Check, Mic, Square, X } from 'lucide-react';
import { type ReactNode, useContext } from 'react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { answerKey } from '../../helpers/answer-key';
import { sayAgainEffectsAtom, sayAgainViewAtom, secondTryAtom } from '../../model/atoms';
import {
  cancelSayAgain,
  retryTranscription,
  startSayAgain,
  stopSayAgain,
} from '../../model/controls';
import type { AnswerTarget, AttemptComparison, PhraseCheck, SayAgainView } from '../../types';

type Props = {
  target: AnswerTarget;
  trailing?: ReactNode;
};

function CheckList({ label, checks }: { label: string; checks: readonly PhraseCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-faint">{label}</span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {checks.map((check) => (
          <li
            className={`text-caption inline-flex items-center gap-1.5 ${check.said ? 'text-ok' : 'text-muted'}`}
            key={check.phrase}
          >
            {check.said ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <X aria-hidden="true" className="size-3.5" />
            )}
            <span>{check.phrase}</span>
            <span className="sr-only">{check.said ? ' said' : ' not said yet'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Comparison({ comparison }: { comparison: AttemptComparison }) {
  return (
    <div className="border-line flex flex-col gap-2 rounded-xl border border-dashed px-3.5 py-3">
      <span className="text-caption text-faint">Second try</span>
      <p className="text-body text-foreground m-0" data-word-lookup>
        {comparison.retry_transcript}
      </p>
      <CheckList checks={comparison.words_to_take} label="Words to take" />
      <CheckList checks={comparison.corrections} label="Corrected fragments" />
    </div>
  );
}

const PROGRESS: Partial<Record<SayAgainView['tag'], string>> = {
  requesting: 'Waiting for the microphone…',
  capturing: 'Recording. Say the whole better version, then stop.',
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
