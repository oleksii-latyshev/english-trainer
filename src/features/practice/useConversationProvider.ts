import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Exit, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { aiSettingsAtom, updateAiSettingsAtom } from '@/core/ai-settings';
import { toast } from '@/shared/ui/toast';

/** The saved conversation model, and the one-press switch to the on-device one after a stalled reply. */
export function useConversationProvider() {
  const settings = useAtomValue(aiSettingsAtom);
  const update = useAtomSet(updateAiSettingsAtom, { mode: 'promiseExit' });
  const provider = Option.getOrNull(AsyncResult.value(settings))?.provider ?? null;

  /** Saves Apple on-device as the conversation model; false when it could not be saved. */
  async function switchToApple(): Promise<boolean> {
    const exit = await update({ provider: 'apple' });
    if (Exit.isSuccess(exit)) return true;
    toast.danger('Could not switch to Apple on-device. You can change the model in Settings.');
    return false;
  }

  return { canSwitchToApple: provider !== null && provider !== 'apple', switchToApple };
}
