import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { prewarmConversationProvider } from '@/lib/aiSettings';
import { warmSpeechEngine } from '@/lib/speechTypes';

export function usePrewarmProvider(sessionId: number | undefined) {
  useEffect(() => {
    if (sessionId === undefined || !isTauri()) return;
    // Warm-up only saves time on the first reply; the turn itself reports real failures.
    void prewarmConversationProvider().catch(() => {});
    // The same for speech recognition: the model loads now, not when the first answer ends. If
    // it cannot, Setup details say so and answers use one-off runs.
    void warmSpeechEngine().catch(() => {});
  }, [sessionId]);
}
