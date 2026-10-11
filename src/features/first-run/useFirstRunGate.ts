import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { useEffect, useState } from 'react';
import { getPreferredDeviceId } from '@/audio/devicePreference';
import { geminiKeyStatusAtom } from '@/features/gemini-key';
import { getLearningMemory } from '@/features/memory/memoryApi';
import { voicePreference } from '@/features/speech/voicePreferences';
import { decideFirstRun, firstRunMarker, type UseEvidence } from '@/lib/firstRun';

/** `checking` until launch has looked for earlier use; `show` sends Talk start to first run. */
export type FirstRunGate = 'checking' | 'show' | 'hidden';

async function gatherEvidence(hasSession: boolean, hasGeminiKey: boolean): Promise<UseEvidence> {
  // A read that fails is "no evidence": the worst case is a learner who can Skip the setup once.
  const [memory] = await Promise.allSettled([getLearningMemory()]);
  return {
    hasSession,
    hasGeminiKey,
    hasMemory:
      memory.status === 'fulfilled' &&
      (memory.value.mistakes.length > 0 || memory.value.phrase_cards.length > 0),
    hasVoiceChoice: voicePreference.get().voiceURI !== null,
    hasMicrophoneChoice: getPreferredDeviceId() !== '',
  };
}

/**
 * Decides once per launch whether first run opens: only while the marker is pending and nothing
 * shows earlier use. It waits for the session restore, and a restored session always wins: that
 * learner is an existing user and is never sent to setup.
 */
export function useFirstRunGate({
  isRestoring,
  hasSession,
}: {
  isRestoring: boolean;
  hasSession: boolean;
}): FirstRunGate {
  const [marker] = firstRunMarker.use();
  const [outcome, setOutcome] = useState<FirstRunGate>('checking');
  // Undefined until the key status has been read; a failed read is "no key".
  const keyStatus = useAtomValue(geminiKeyStatusAtom);
  const hasGeminiKey = AsyncResult.isInitial(keyStatus)
    ? undefined
    : AsyncResult.isSuccess(keyStatus) && keyStatus.value.configured;

  useEffect(() => {
    if (
      marker.status !== 'pending' ||
      isRestoring ||
      outcome !== 'checking' ||
      hasGeminiKey === undefined
    ) {
      return;
    }
    let isCurrent = true;
    void gatherEvidence(hasSession, hasGeminiKey).then((evidence) => {
      if (!isCurrent) return;
      const decision = decideFirstRun('pending', evidence);
      if (decision === 'existing-user') firstRunMarker.set({ status: 'existing' });
      setOutcome(decision === 'show' ? 'show' : 'hidden');
    });
    return () => {
      isCurrent = false;
    };
  }, [marker.status, isRestoring, hasSession, hasGeminiKey, outcome]);

  return marker.status === 'pending' ? outcome : 'hidden';
}
