import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ipcFailureMessage } from '@/core/ipc';
import {
  nativeLanguageAtom,
  prepareTranslationLanguagesAtom,
  setNativeLanguageAtom,
  TRANSLATION_LANGUAGES,
  translationAvailabilityAtom,
} from '@/core/translation-settings';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { Select } from '@/shared/ui/select';
import {
  AVAILABILITY_UNREADABLE,
  availabilityCopy,
  CHECKING_AVAILABILITY,
  needsPreparation,
} from '../../helpers/availability-copy';

const LANGUAGE_UNREADABLE = 'Translation settings could not be read. Try again.';
const SAVE_FAILED = 'The native language could not be saved. Try again.';
const PREPARE_FAILED = 'The languages could not be prepared. Try again.';

function AvailabilityRow({ language, isBusy }: { language: string; isBusy: boolean }) {
  const availability = useAtomValue(translationAvailabilityAtom);
  const recheck = useAtomRefresh(translationAvailabilityAtom);
  const prepare = useAtomSet(prepareTranslationLanguagesAtom);
  const status = Option.getOrNull(AsyncResult.value(availability));
  const copy = status ? availabilityCopy(status, language) : null;
  const failed = status === null && AsyncResult.isFailure(availability);
  return (
    <FormRow
      description={
        failed ? (
          AVAILABILITY_UNREADABLE
        ) : (
          <span className={copy?.tone === 'ready' ? 'text-ok-text' : undefined}>
            {copy?.text ?? CHECKING_AVAILABILITY}
          </span>
        )
      }
      title="Language availability"
    >
      {status && needsPreparation(status, language) && (
        <Button disabled={isBusy} onClick={() => prepare(undefined)} tone="ghost">
          {isBusy ? 'Preparing…' : 'Prepare languages'}
        </Button>
      )}
      {failed && (
        <Button onClick={recheck} tone="ghost">
          Retry
        </Button>
      )}
    </FormRow>
  );
}

function TranslationRows({ language }: { language: string }) {
  const save = useAtomSet(setNativeLanguageAtom);
  const saveResult = useAtomValue(setNativeLanguageAtom);
  const prepareResult = useAtomValue(prepareTranslationLanguagesAtom);
  const isSaving = AsyncResult.isWaiting(saveResult);
  const isPreparing = AsyncResult.isWaiting(prepareResult);
  const saveFailure = isSaving ? Option.none() : AsyncResult.error(saveResult);
  const prepareFailure = isPreparing ? Option.none() : AsyncResult.error(prepareResult);
  return (
    <>
      <FormRow
        description="Selected English words are translated into this language on demand."
        title="Native language"
      >
        <Select<string>
          disabled={isSaving || isPreparing}
          label="Native language"
          onChange={save}
          options={TRANSLATION_LANGUAGES}
          value={language}
        />
      </FormRow>
      <AvailabilityRow isBusy={isPreparing} language={language} />
      <Notice tone="quiet">
        Translation stays on this Mac. English explanations use Apple Intelligence and may be
        unavailable independently.
      </Notice>
      {Option.isSome(saveFailure) && (
        <Notice role="alert" tone="error">
          {ipcFailureMessage(saveFailure.value, SAVE_FAILED)}
        </Notice>
      )}
      {Option.isSome(prepareFailure) && (
        <Notice role="alert" tone="error">
          {ipcFailureMessage(prepareFailure.value, PREPARE_FAILED)}
        </Notice>
      )}
    </>
  );
}

export function TranslationSettings() {
  const nativeLanguage = useAtomValue(nativeLanguageAtom);
  const reload = useAtomRefresh(nativeLanguageAtom);
  const language = Option.getOrNull(AsyncResult.value(nativeLanguage));
  return (
    <GroupCard id="translation" title="Translation">
      {language !== null ? (
        <TranslationRows language={language} />
      ) : (
        Option.match(AsyncResult.error(nativeLanguage), {
          onNone: () => (
            <Notice role="status" tone="quiet">
              Loading translation settings…
            </Notice>
          ),
          onSome: (failure) => (
            <FormRow
              description={ipcFailureMessage(failure, LANGUAGE_UNREADABLE)}
              title="Translation settings could not be loaded"
            >
              <Button onClick={reload}>Retry</Button>
            </FormRow>
          ),
        })
      )}
    </GroupCard>
  );
}
