import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { SpeechCheckStatus, SpeechModels, SpeechSettings } from '@/core/ipc';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { SETTINGS_UNREADABLE } from '../../helpers/failure-copy';
import { speechCheckAtom, speechModelsAtom, speechSettingsAtom } from '../../model/atoms';
import { EngineRows } from '../engine-rows';
import { MeasureModels } from '../measure-models';
import { ModelRow } from '../model-row';
import { SpeechCheck } from '../speech-check';

type Props = { isPracticeCapturing: boolean };

export function SpeechRecognitionSettings({ isPracticeCapturing }: Props) {
  const settings = useAtomValue(speechSettingsAtom);
  const models = useAtomValue(speechModelsAtom);
  const check = useAtomValue(speechCheckAtom);
  const values = Option.all({
    settings: AsyncResult.value(settings),
    models: AsyncResult.value(models),
    check: AsyncResult.value(check),
  });
  const hasFailed =
    AsyncResult.isFailure(settings) ||
    AsyncResult.isFailure(models) ||
    AsyncResult.isFailure(check);
  return (
    <GroupCard id="speech" title="Speech recognition">
      {Option.isSome(values) ? (
        <ReadyBody
          check={values.value.check}
          isPracticeCapturing={isPracticeCapturing}
          models={values.value.models}
          settings={values.value.settings}
        />
      ) : (
        <Notice role={hasFailed ? 'alert' : 'status'} tone={hasFailed ? 'error' : 'quiet'}>
          {hasFailed ? SETTINGS_UNREADABLE : 'Loading…'}
        </Notice>
      )}
    </GroupCard>
  );
}

type ReadyProps = {
  settings: SpeechSettings;
  models: SpeechModels;
  check: SpeechCheckStatus;
  isPracticeCapturing: boolean;
};

function ReadyBody({ settings, models, check, isPracticeCapturing }: ReadyProps) {
  return (
    <>
      {models.override_path && (
        <Notice role="status" tone="warn">
          ENG_TRAINER_WHISPER_MODEL is set, so the app uses {models.override_path} whatever you
          choose here.
        </Notice>
      )}
      <ModelRow check={check} models={models} settings={settings} />
      <EngineRows settings={settings} />
      {models.models.length === 0 && (
        <Notice role="status" tone="warn">
          No models were found in the app's models folder. Put ggml-*.bin files there (see the
          README, Local transcription setup).
        </Notice>
      )}
      <SpeechCheck check={check} isPracticeCapturing={isPracticeCapturing} />
      <MeasureModels check={check} modelInUse={settings.model_file} models={models.models} />
    </>
  );
}
