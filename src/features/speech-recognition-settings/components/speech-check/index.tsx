import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Mic, Square } from 'lucide-react';
import { clipPhaseAtom, IDLE_CLIP, stopClipAtom, usePreferredMicrophone } from '@/core/audio';
import type { SentenceStatus, SpeechCheckStatus } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { LevelMeter } from '@/shared/ui/level-meter';
import { Notice } from '@/shared/ui/notice';
import { DELETE_FAILED, settledFailureMessage } from '../../helpers/failure-copy';
import { micName, recorderHint } from '../../helpers/sentence-recorder';
import { currentSentenceIndex } from '../../helpers/speech-check';
import {
  deleteSpeechCheckRecordingsAtom,
  recordSentenceAtom,
  selectedSentenceAtom,
  sentenceRecorderAtom,
} from '../../model/atoms';

type Props = { check: SpeechCheckStatus; isPracticeCapturing: boolean };

type SentenceCardProps = {
  sentence: SentenceStatus;
  total: number;
  isPracticeCapturing: boolean;
  isOccupiedElsewhere: boolean;
};

function SentenceCard({
  sentence,
  total,
  isPracticeCapturing,
  isOccupiedElsewhere,
}: SentenceCardProps) {
  const { selectedDeviceId } = usePreferredMicrophone();
  const recorder = useAtomValue(sentenceRecorderAtom);
  const select = useAtomSet(selectedSentenceAtom);
  const record = useAtomSet(recordSentenceAtom);
  const stop = useAtomSet(stopClipAtom);
  const isRecording = recorder.tag === 'recording';
  const isBusy = recorder.tag === 'requesting' || recorder.tag === 'saving';
  const isLocked = isRecording || isBusy;
  return (
    <Notice>
      <div className="flex flex-col gap-2.5">
        <p className="m-0 text-muted text-xs">
          Sentence {sentence.index} of {total}
          {sentence.is_recorded && ' · recorded'}
        </p>
        <p className="m-0 text-lg leading-snug">{sentence.text}</p>
        <div className="flex items-center gap-4">
          <Button
            disabled={sentence.index <= 1 || isLocked}
            onClick={() => select(sentence.index - 1)}
            tone="ghost"
          >
            Previous
          </Button>
          <Button
            aria-label={micName(isRecording, sentence.is_recorded)}
            disabled={isPracticeCapturing || isBusy || isOccupiedElsewhere}
            iconOnly
            onClick={() =>
              isRecording
                ? stop(undefined)
                : record({ index: sentence.index, deviceId: selectedDeviceId })
            }
            tone={isRecording ? 'danger' : 'secondary'}
          >
            {isRecording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
          </Button>
          <LevelMeter
            label="Live microphone input level"
            level={recorder.tag === 'recording' ? recorder.level : undefined}
          />
          <Button
            disabled={sentence.index >= total || isLocked}
            onClick={() => select(sentence.index + 1)}
            tone="ghost"
          >
            {sentence.is_recorded ? 'Next' : 'Skip'}
          </Button>
        </div>
        <p className="m-0 text-muted text-xs" role={recorder.tag === 'error' ? 'alert' : 'status'}>
          {recorderHint(recorder, sentence.is_recorded)}
        </p>
        {isPracticeCapturing && (
          <p className="m-0 text-muted text-xs" role="status">
            Finish the active practice recording first: it uses the microphone.
          </p>
        )}
      </div>
    </Notice>
  );
}

export function SpeechCheck({ check, isPracticeCapturing }: Props) {
  const selected = useAtomValue(selectedSentenceAtom);
  const recorder = useAtomValue(sentenceRecorderAtom);
  const phase = AsyncResult.getOrElse(useAtomValue(clipPhaseAtom), () => IDLE_CLIP);
  const deleteResult = useAtomValue(deleteSpeechCheckRecordingsAtom);
  const deleteAll = useAtomSet(deleteSpeechCheckRecordingsAtom);
  const current = currentSentenceIndex(selected, check.sentences);
  const sentence = check.sentences.find((item) => item.index === current);
  const recordedCount = check.sentences.filter((item) => item.is_recorded).length;
  const isActive = recorder.tag !== 'idle' && recorder.tag !== 'error';
  const isOccupiedElsewhere = phase.tag !== 'idle' && !isActive;
  const deleteFailure = settledFailureMessage(deleteResult, DELETE_FAILED);
  if (!sentence) return null;
  return (
    <>
      <FormRow
        description={`${recordedCount} of ${check.sentences.length} sentences recorded. The recordings stay on this Mac as a test set, only because you made one, until you delete them.`}
        title="Speech check"
      >
        <Button
          disabled={recordedCount === 0 || isActive}
          onClick={() => deleteAll(undefined)}
          tone="ghost"
        >
          Delete recordings
        </Button>
      </FormRow>
      {deleteFailure && (
        <Notice role="alert" tone="error">
          {deleteFailure}
        </Notice>
      )}
      <SentenceCard
        isOccupiedElsewhere={isOccupiedElsewhere}
        isPracticeCapturing={isPracticeCapturing}
        sentence={sentence}
        total={check.sentences.length}
      />
    </>
  );
}
