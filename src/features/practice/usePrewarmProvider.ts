import { useAtomSet } from '@effect/atom-react';
import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { prewarmConversationProviderAtom } from '@/core/ai-settings';
import type { PracticeMode, PracticePhase } from '@/lib/practiceOptions';
import { warmSpeechEngine } from '@/lib/speechTypes';

export function usePrewarmProvider(
  sessionId: number | undefined,
  mode: PracticeMode | undefined,
  phase: PracticePhase | undefined,
  shouldPrewarmConversation = true,
) {
  const prewarmConversation = useAtomSet(prewarmConversationProviderAtom);

  useEffect(() => {
    if (sessionId === undefined || !isTauri()) return;
    // Warm-up only saves time on the first reply; the turn itself reports real failures.
    if (shouldPrewarmConversation) prewarmConversation(undefined);
    // The same for speech recognition: the model loads now, not when the first answer ends. If
    // it cannot, Setup details say so and answers use one-off runs.
    if (mode === 'voice' || (mode === 'write_then_speak' && phase === 'speaking')) {
      void warmSpeechEngine().catch(() => {});
    }
  }, [sessionId, mode, phase, shouldPrewarmConversation, prewarmConversation]);
}
