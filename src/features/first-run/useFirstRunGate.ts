import { useEffect, useState } from 'react';
import { getPreferredDeviceId } from '@/audio/devicePreference';
import { getLearningMemory } from '@/features/memory/memoryApi';
import { voicePreference } from '@/features/speech/voicePreferences';
import { decideFirstRun, firstRunMarker, type UseEvidence } from '@/lib/firstRun';
import { getGeminiKeyStatus } from '@/lib/geminiKey';

/** `checking` until launch has looked for earlier use; `show` sends Talk start to first run. */
export type FirstRunGate = 'checking' | 'show' | 'hidden';

async function gatherEvidence(hasSession: boolean): Promise<UseEvidence> {
  // A read that fails is "no evidence": the worst case is a learner who can Skip the setup once.
  const [key, memory] = await Promise.allSettled([getGeminiKeyStatus(), getLearningMemory()]);
  return {
    hasSession,
    hasGeminiKey: key.status === 'fulfilled' && key.value.configured,
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

  useEffect(() => {
    if (marker.status !== 'pending' || isRestoring || outcome !== 'checking') return;
    let isCurrent = true;
    void gatherEvidence(hasSession).then((evidence) => {
      if (!isCurrent) return;
      const decision = decideFirstRun('pending', evidence);
      if (decision === 'existing-user') firstRunMarker.set({ status: 'existing' });
      setOutcome(decision === 'show' ? 'show' : 'hidden');
    });
    return () => {
      isCurrent = false;
    };
  }, [marker.status, isRestoring, hasSession, outcome]);

  return marker.status === 'pending' ? outcome : 'hidden';
}
