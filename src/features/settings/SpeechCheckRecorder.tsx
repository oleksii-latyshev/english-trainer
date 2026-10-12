import { useState } from 'react';
import {
  deleteSpeechCheckRecordings,
  type SentenceStatus,
  type SpeechCheckStatus,
  saveSpeechCheckRecording,
  speechErrorMessage,
} from '@/app/speech-capture';
import { LevelMeter, MicButton } from '@/components/MicControl';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { nextSentenceIndex, startingSentenceIndex } from './lib/speechCheck';
import { type SentenceRecorderState, useSentenceRecorder } from './useSentenceRecorder';

function recorderHint(state: SentenceRecorderState, isRecorded: boolean): string {
  switch (state.tag) {
    case 'requesting':
      return 'Preparing the microphone (about 3 seconds). Wait for the bars to move before reading.';
    case 'recording':
      return 'Recording. Read the sentence, then press stop.';
    case 'saving':
      return 'Saving the recording…';
    case 'error':
      return state.message;
    case 'idle':
      return isRecorded
        ? 'Recorded. Press the microphone to read it again and replace the recording.'
        : 'Press the microphone, read the sentence aloud, then press stop.';
  }
}

type Recorder = ReturnType<typeof useSentenceRecorder>;

function micName(isRecording: boolean, isRecorded: boolean): string {
  if (isRecording) return 'Stop recording';
  return isRecorded ? 'Record this sentence again' : 'Record this sentence';
}

function SentenceControls({
  current,
  total,
  sentence,
  recorder,
  isBusy,
  isRecording,
  isDisabled,
  onGo,
}: {
  current: number;
  total: number;
  sentence: SentenceStatus;
  recorder: Recorder;
  isBusy: boolean;
  isRecording: boolean;
  isDisabled: boolean;
  onGo: (index: number) => void;
}) {
  return (
    <div className="speech-sentence-controls">
      <Button
        disabled={current <= 1 || isRecording || isBusy}
        onClick={() => onGo(current - 1)}
        tone="ghost"
      >
        Previous
      </Button>
      <MicButton
        icon={isRecording ? 'stop' : 'mic'}
        isDisabled={isDisabled || isBusy}
        name={micName(isRecording, sentence.is_recorded)}
        onPress={isRecording ? recorder.stop : () => void recorder.start()}
        variant={isRecording ? 'live' : 'ready'}
      />
      <LevelMeter
        isActive={isRecording}
        level={recorder.state.tag === 'recording' ? recorder.state.level : 0}
      />
      <Button
        disabled={current >= total || isRecording || isBusy}
        onClick={() => onGo(current + 1)}
        tone="ghost"
      >
        {sentence.is_recorded ? 'Next' : 'Skip'}
      </Button>
    </div>
  );
}

/** Reads the fixed sentences one at a time; each recording replaces the previous one of its sentence. */
export function SpeechCheckRecorder({
  check,
  deviceId,
  isDisabled,
  onChange,
}: {
  check: SpeechCheckStatus;
  deviceId: string;
  /** True while practice owns the microphone. */
  isDisabled: boolean;
  onChange: (check: SpeechCheckStatus) => void;
}) {
  const [current, setCurrent] = useState(() => startingSentenceIndex(check.sentences));
  const [deleteError, setDeleteError] = useState<string>();
  const recorder = useSentenceRecorder(deviceId, async (wav) => {
    const status = await saveSpeechCheckRecording(current, wav);
    onChange(status);
    const next = nextSentenceIndex(status.sentences, current);
    if (next !== undefined) setCurrent(next);
  });

  const sentence = check.sentences.find((item) => item.index === current);
  const total = check.sentences.length;
  const recordedCount = check.sentences.filter((item) => item.is_recorded).length;
  const isBusy = recorder.state.tag === 'requesting' || recorder.state.tag === 'saving';
  const isRecording = recorder.state.tag === 'recording';

  async function handleDelete() {
    setDeleteError(undefined);
    try {
      onChange(await deleteSpeechCheckRecordings());
      setCurrent(1);
    } catch (cause) {
      setDeleteError(speechErrorMessage(cause, 'The recordings could not be deleted.'));
    }
  }

  if (!sentence) return null;
  return (
    <>
      <FormRow
        description={`${recordedCount} of ${total} sentences recorded. The recordings stay on this Mac as a test set, only because you made one, until you delete them.`}
        title="Speech check"
      >
        <Button
          disabled={recordedCount === 0 || isRecording || isBusy}
          onClick={() => void handleDelete()}
          tone="ghost"
        >
          Delete recordings
        </Button>
      </FormRow>
      {deleteError && (
        <Notice role="alert" tone="error">
          {deleteError}
        </Notice>
      )}
      <Notice>
        <div className="speech-sentence">
          <p className="speech-sentence-count">
            Sentence {sentence.index} of {total}
            {sentence.is_recorded && ' · recorded'}
          </p>
          <p className="speech-sentence-text">{sentence.text}</p>
          <SentenceControls
            current={current}
            isBusy={isBusy}
            isDisabled={isDisabled}
            isRecording={isRecording}
            onGo={setCurrent}
            recorder={recorder}
            sentence={sentence}
            total={total}
          />
          <p
            className="speech-sentence-hint"
            role={recorder.state.tag === 'error' ? 'alert' : 'status'}
          >
            {recorderHint(recorder.state, sentence.is_recorded)}
          </p>
          {isDisabled && (
            <p className="speech-sentence-hint" role="status">
              Finish the active practice recording first: it uses the microphone.
            </p>
          )}
        </div>
      </Notice>
    </>
  );
}
