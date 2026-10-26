import type { AtomRegistry } from 'effect/reactivity';
import { isSessionOpen } from '../helpers/practice-state';
import { practiceStateAtom } from './atoms';
import { startPracticeAtom } from './commands';

export function startOrResumePractice(
  registry: AtomRegistry.AtomRegistry,
  openConversation: () => void,
) {
  const state = registry.get(practiceStateAtom);
  if (!isSessionOpen(state)) {
    registry.set(startPracticeAtom, undefined);
    return;
  }
  if (state.tag === 'active' || state.tag === 'waiting') openConversation();
}
