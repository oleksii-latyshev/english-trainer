import { useAtom, useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import { useEffect } from 'react';
import { readPreferredMicrophone } from '@/core/audio';
import { decideFirstRun, firstRunMarkerAtom, type UseEvidence } from '@/core/first-run';
import { type LearningMemory, learningMemoryAtom } from '@/core/learning-memory';
import { readSpeechVoice } from '@/core/voice-preference';
import { geminiKeyStatusAtom } from '@/features/gemini-key';

export type FirstRunGate = 'checking' | 'show' | 'hidden';

const firstRunOutcomeAtom = Atom.keepAlive(Atom.make<FirstRunGate>('checking'));

export function useFirstRunDecision(): FirstRunGate {
  const marker = useAtomValue(firstRunMarkerAtom);
  const outcome = useAtomValue(firstRunOutcomeAtom);
  return marker.status === 'pending' ? outcome : 'hidden';
}

function hasSavedMemory(memory: LearningMemory): boolean {
  return memory.mistakes.length > 0 || memory.phrase_cards.length > 0;
}

function gatherEvidence(options: {
  hasSession: boolean;
  hasGeminiKey: boolean;
  hasMemory: boolean;
}): UseEvidence {
  return {
    hasSession: options.hasSession,
    hasGeminiKey: options.hasGeminiKey,
    hasMemory: options.hasMemory,
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
  const [outcome, setOutcome] = useAtom(firstRunOutcomeAtom);
  const keyStatus = useAtomValue(geminiKeyStatusAtom);
  const memory = useAtomValue(learningMemoryAtom);
  const hasGeminiKey = AsyncResult.isInitial(keyStatus)
    ? undefined
    : AsyncResult.isSuccess(keyStatus) && keyStatus.value.configured;
  const hasMemory = AsyncResult.isInitial(memory)
    ? undefined
    : AsyncResult.isSuccess(memory) && hasSavedMemory(memory.value);

  useEffect(() => {
    if (
      marker.status !== 'pending' ||
      isRestoring ||
      outcome !== 'checking' ||
      hasGeminiKey === undefined ||
      hasMemory === undefined
    ) {
      return;
    }
    const decision = decideFirstRun(
      'pending',
      gatherEvidence({ hasSession, hasGeminiKey, hasMemory }),
    );
    if (decision === 'existing-user') setMarker({ status: 'existing' });
    setOutcome(decision === 'show' ? 'show' : 'hidden');
  }, [
    marker.status,
    isRestoring,
    hasSession,
    hasGeminiKey,
    hasMemory,
    outcome,
    setMarker,
    setOutcome,
  ]);

  return marker.status === 'pending' ? outcome : 'hidden';
}
