import type { AtomRegistry } from 'effect/reactivity';
import { removePhrase } from '../helpers/phrase-selection';
import { changeSelection } from './atoms';

export function removeWrapupPhrase(
  registry: AtomRegistry.AtomRegistry,
  sessionId: number,
  phrase: string,
) {
  changeSelection(registry, sessionId, (selection) => removePhrase(selection, phrase));
}
