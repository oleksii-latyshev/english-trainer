import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { SpeechSettings } from '@/core/ipc';
import { Chip } from '@/shared/ui/chip';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { Switch } from '@/shared/ui/switch';
import { engineLabel, engineProblem, liveTranscriptDescription } from '../../helpers/engine-status';
import { LIVE_SAVE_FAILED, settledFailureMessage } from '../../helpers/failure-copy';
import { engineStatusAtom, saveLiveTranscriptAtom } from '../../model/atoms';

type Props = { settings: SpeechSettings };

export function EngineRows({ settings }: Props) {
  const engine = Option.getOrUndefined(AsyncResult.value(useAtomValue(engineStatusAtom)));
  const saveResult = useAtomValue(saveLiveTranscriptAtom);
  const saveLiveTranscript = useAtomSet(saveLiveTranscriptAtom);
  const problem = engine ? engineProblem(engine) : '';
  const saveFailure = settledFailureMessage(saveResult, LIVE_SAVE_FAILED);
  return (
    <>
      {engine && (
        <FormRow
          description="The model stays in memory between answers, so an answer is transcribed in a fraction of a second."
          title="Model in memory"
        >
          <Chip>
            <span role="status">{engineLabel(engine)}</span>
          </Chip>
        </FormRow>
      )}
      {problem && (
        <Notice role="status" tone="warn">
          {problem}
        </Notice>
      )}
      <FormRow description={liveTranscriptDescription(settings, engine)} title="Live transcript">
        <Switch
          checked={settings.live_transcript}
          isLabelHidden
          label="Live transcript"
          onCheckedChange={saveLiveTranscript}
        />
      </FormRow>
      {saveFailure && (
        <Notice role="alert" tone="error">
          {saveFailure}
        </Notice>
      )}
    </>
  );
}
