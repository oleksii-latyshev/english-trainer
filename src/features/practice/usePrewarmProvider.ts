import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { prewarmConversationProvider } from '@/lib/aiSettings';

export function usePrewarmProvider(sessionId: number | undefined) {
  useEffect(() => {
    if (sessionId === undefined || !isTauri()) return;
    // Warm-up only saves time on the first reply; the turn itself reports real failures.
    void prewarmConversationProvider().catch(() => {});
  }, [sessionId]);
}
