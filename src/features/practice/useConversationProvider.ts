import { toast } from '@heroui/react';
import { useEffect, useState } from 'react';
import { getAiSettings, saveAiSettings } from '@/lib/aiSettings';
import type { ConversationProviderId } from '@/lib/types';

/** The saved conversation model, and the one-press switch to the on-device one after a stalled reply. */
export function useConversationProvider() {
  const [provider, setProvider] = useState<ConversationProviderId | null>(null);

  useEffect(() => {
    let isCurrent = true;
    getAiSettings()
      .then((settings) => {
        if (isCurrent) setProvider(settings.provider);
      })
      .catch(() => {
        // Harmless by design: the provider only decides whether the shortcut is offered.
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  /** Saves Apple on-device as the conversation model; false when it could not be saved. */
  async function switchToApple(): Promise<boolean> {
    try {
      const current = await getAiSettings();
      const saved = await saveAiSettings({ ...current, provider: 'apple' });
      setProvider(saved.provider);
      return true;
    } catch {
      toast.danger('Could not switch to Apple on-device. You can change the model in Settings.');
      return false;
    }
  }

  return { canSwitchToApple: provider !== null && provider !== 'apple', switchToApple };
}
