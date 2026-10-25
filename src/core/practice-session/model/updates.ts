import type { AtomRegistry } from 'effect/reactivity';
import type { ConversationTurn } from '@/core/ipc';
import {
  advancePractice,
  recordRetryComparison,
  setTurnPending,
  updatePracticeClock,
} from '../helpers/practice-state';
import type { AttemptComparison, PracticeSession, PracticeState } from '../types';
import { practiceErrorAtom, practiceStateAtom } from './atoms';

export function acceptTurn(
  registry: AtomRegistry.AtomRegistry,
  sessionId: number,
  turn: Pick<ConversationTurn, 'question' | 'spoken_reply'>,
) {
  registry.update(practiceStateAtom, (state) => advancePractice(state, sessionId, turn));
}

export function markTurnPending(registry: AtomRegistry.AtomRegistry, isPending: boolean) {
  registry.update(practiceStateAtom, (state) => setTurnPending(state, isPending));
}

export function acceptRetryComparison(
  registry: AtomRegistry.AtomRegistry,
  sessionId: number,
  comparison: AttemptComparison,
) {
  registry.update(practiceStateAtom, (state) =>
    recordRetryComparison(state, sessionId, comparison),
  );
}

export function dismissSummary(registry: AtomRegistry.AtomRegistry) {
  registry.update(
    practiceStateAtom,
    (state): PracticeState => (state.tag === 'completed' ? { tag: 'idle' } : state),
  );
}

export function applyClockSnapshot(registry: AtomRegistry.AtomRegistry, session: PracticeSession) {
  registry.update(practiceStateAtom, (state) =>
    updatePracticeClock(state, session, performance.now()),
  );
}

export function reportPracticeError(registry: AtomRegistry.AtomRegistry, message: string) {
  registry.set(practiceErrorAtom, message);
}
