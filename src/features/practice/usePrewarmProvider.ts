import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { prewarmConversationProvider } from '@/lib/aiSettings';
import type { PracticeMode, PracticePhase } from '@/lib/practiceOptions';
import { warmSpeechEngine } from '@/lib/speechTypes';

export function usePrewarmProvider(
  sessionId: number | undefined,
  mode: PracticeMode | undefined,
  phase: PracticePhase | undefined,
  shouldPrewarmConversation = true,
) {
  useEffect(() => {
    if (sessionId === undefined || !isTauri()) return;
    // Warm-up only saves time on the first reply; the turn itself reports real failures.
    if (shouldPrewarmConversation) void prewarmConversationProvider().catch(() => {});
    // The same for speech recognition: the model loads now, not when the first answer ends. If
    // it cannot, Setup details say so and answers use one-off runs.
    if (mode === 'voice' || (mode === 'write_then_speak' && phase === 'speaking')) {
      void warmSpeechEngine().catch(() => {});
    }
  }, [sessionId, mode, phase, shouldPrewarmConversation]);
}
