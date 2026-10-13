import { useAtom, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { useEffect, useState } from 'react';
import { readPreferredMicrophone } from '@/core/audio';
import { decideFirstRun, firstRunMarkerAtom, type UseEvidence } from '@/core/first-run';
import { readSpeechVoice } from '@/core/voice-preference';
import { geminiKeyStatusAtom } from '@/features/gemini-key';
import { getLearningMemory } from '@/features/memory/memoryApi';

export type FirstRunGate = 'checking' | 'show' | 'hidden';

async function gatherEvidence(hasSession: boolean, hasGeminiKey: boolean): Promise<UseEvidence> {
  const [memory] = await Promise.allSettled([getLearningMemory()]);
  return {
    hasSession,
    hasGeminiKey,
    hasMemory:
      memory.status === 'fulfilled' &&
      (memory.value.mistakes.length > 0 || memory.value.phrase_cards.length > 0),
    hasVoiceChoice: readSpeechVoice().voiceURI !== null,
    hasMicrophoneChoice: readPreferredMicrophone() !== '',
  };
}

export function useFirstRunGate({
  isRestoring,
  hasSession,
}: {
  isRestoring: boolean;
  hasSession: boolean;
}): FirstRunGate {
  const [marker, setMarker] = useAtom(firstRunMarkerAtom);
  const [outcome, setOutcome] = useState<FirstRunGate>('checking');
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
      if (decision === 'existing-user') setMarker({ status: 'existing' });
      setOutcome(decision === 'show' ? 'show' : 'hidden');
    });
    return () => {
      isCurrent = false;
    };
  }, [marker.status, isRestoring, hasSession, hasGeminiKey, outcome, setMarker]);

  return marker.status === 'pending' ? outcome : 'hidden';
}
