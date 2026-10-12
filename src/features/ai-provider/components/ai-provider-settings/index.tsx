import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ReactNode } from 'react';
import { aiSettingsAtom, aiSettingsErrorMessage, updateAiSettingsAtom } from '@/core/ai-settings';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { Select } from '@/shared/ui/select';
import { ProviderChoice } from '../provider-choice';
import { ResponseTest } from '../response-test';
import { AGY_MODEL_OPTIONS, EVA_STYLE_OPTIONS } from './constants';

type Props = { geminiKeyField: ReactNode };

export function AiProviderSettings({ geminiKeyField }: Props) {
  const settingsResult = useAtomValue(aiSettingsAtom);
  const updateResult = useAtomValue(updateAiSettingsAtom);
  const update = useAtomSet(updateAiSettingsAtom);
  const reload = useAtomRefresh(aiSettingsAtom);
  const settings = Option.getOrNull(AsyncResult.value(settingsResult));
  const isSaving = AsyncResult.isWaiting(updateResult);
  const saveFailure = isSaving ? Option.none() : AsyncResult.error(updateResult);

  if (settings === null) {
    return Option.match(AsyncResult.error(settingsResult), {
      onNone: () => (
        <Notice role="status" tone="quiet">
          Loading conversation AI settings…
        </Notice>
      ),
      onSome: (failure) => (
        <FormRow
          description={aiSettingsErrorMessage(
            failure,
            'Failed to load conversation AI settings. Please check your setup and try again.',
          )}
          title="Settings could not be loaded"
        >
          <Button onClick={reload}>Retry</Button>
        </FormRow>
      ),
    });
  }

  return (
    <>
      <ProviderChoice
        disabled={isSaving}
        onChoose={(provider) => update({ provider })}
        provider={settings.provider}
      />
      {Option.isSome(saveFailure) && (
        <Notice role="alert" tone="error">
          {aiSettingsErrorMessage(
            saveFailure.value,
            'Failed to save conversation AI settings. Please try again.',
          )}
        </Notice>
      )}
      {settings.provider === 'agy' && (
        <FormRow
          description="Every Antigravity request names a Gemini model, so Antigravity's own default is never used."
          title="Antigravity model"
        >
          <Select
            disabled={isSaving}
            label="Antigravity model"
            onChange={(agy_model) => update({ agy_model })}
            options={AGY_MODEL_OPTIONS}
            value={settings.agy_model}
          />
        </FormRow>
      )}
      {settings.provider === 'gemini' && geminiKeyField}
      <FormRow
        description="Natural: two to four sentences with her own reactions. Short and simple: one or two plain sentences. Eva always ends with one question."
        title="Eva's style"
      >
        <Select
          disabled={isSaving}
          label="Eva's style"
          onChange={(eva_style) => update({ eva_style })}
          options={EVA_STYLE_OPTIONS}
          value={settings.eva_style}
        />
      </FormRow>
      <ResponseTest provider={settings.provider} />
      <Notice tone="quiet">
        <p>
          Coaching under your answers runs in the background through Antigravity with Gemini 3.8
          Flash, whichever conversation provider you choose, so it never slows Eva down. Answer
          examples and memory checks use Antigravity too.
        </p>
      </Notice>
    </>
  );
}
