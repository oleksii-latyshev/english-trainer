import type { AtomRegistry } from 'effect/reactivity';
import { useEffect, useRef } from 'react';
import type { SessionDetails } from '@/core/practice-session';
import { lockTurn } from '@/core/practice-turn';

export function useTurnLock(registry: AtomRegistry.AtomRegistry, isLocked: boolean) {
  useEffect(() => {
    lockTurn(registry, isLocked);
    return () => lockTurn(registry, false);
  }, [registry, isLocked]);
}

export function useCancelOnStageChange(session: SessionDetails | undefined, cancel: () => void) {
  const phaseKey = session ? `${session.practiceMode}:${session.practicePhase}` : undefined;
  const previous = useRef(phaseKey);
  useEffect(() => {
    if (previous.current === phaseKey) return;
    previous.current = phaseKey;
    cancel();
  }, [phaseKey, cancel]);
}
