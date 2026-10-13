import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Smartphone, Sparkles } from 'lucide-react';
import { aiSettingsAtom, aiSettingsErrorMessage, updateAiSettingsAtom } from '@/core/ai-settings';
import type { ConversationProvider } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { ChoiceList } from '@/shared/ui/choice-list';
import { IconTile } from '@/shared/ui/icon-tile';
import { Notice } from '@/shared/ui/notice';

const OPTIONS = [
  {
    value: 'gemini',
    title: 'Gemini',
    badge: 'Recommended',
    subtitle: 'Fastest and most natural · free key from Google',
    icon: (
      <IconTile tone="sky">
        <Sparkles />
      </IconTile>
    ),
  },
  {
    value: 'apple',
    title: 'Apple on-device',
    subtitle: 'Private and offline · shorter replies · no key',
    icon: (
      <IconTile tone="grey">
        <Smartphone />
      </IconTile>
    ),
  },
] as const;

const OFFERED = new Set<ConversationProvider>(OPTIONS.map((option) => option.value));

function isOffered(provider: ConversationProvider): provider is (typeof OPTIONS)[number]['value'] {
  return OFFERED.has(provider);
}

export function ProviderList() {
  const settingsResult = useAtomValue(aiSettingsAtom);
  const updateResult = useAtomValue(updateAiSettingsAtom);
  const update = useAtomSet(updateAiSettingsAtom);
  const reload = useAtomRefresh(aiSettingsAtom);
  const settings = Option.getOrNull(AsyncResult.value(settingsResult));
  const isSaving = AsyncResult.isWaiting(updateResult);
  const saveFailure = isSaving ? Option.none() : AsyncResult.error(updateResult);
  const loadFailure = settings === null ? AsyncResult.error(settingsResult) : Option.none();

  return (
    <div className="flex flex-col gap-2">
      {Option.isSome(loadFailure) && (
        <Notice role="alert" tone="error">
          {aiSettingsErrorMessage(
            loadFailure.value,
            'Conversation AI settings could not be loaded.',
          )}
          <Button onClick={reload} tone="ghost">
            Retry
          </Button>
        </Notice>
      )}
      <ChoiceList
        disabled={settings === null || isSaving}
        label="Conversation AI"
        onChange={(provider) => update({ provider })}
        options={OPTIONS}
        value={settings !== null && isOffered(settings.provider) ? settings.provider : null}
      />
      {Option.isSome(saveFailure) && (
        <Notice role="alert" tone="error">
          {aiSettingsErrorMessage(
            saveFailure.value,
            'The choice could not be saved. Please try again.',
          )}
        </Notice>
      )}
      {settings?.provider === 'agy' && (
        <Notice role="status" tone="quiet">
          Antigravity is selected from an earlier setup. Choose Gemini or Apple on-device above, or
          keep it and change nothing.
        </Notice>
      )}
    </div>
  );
}
