import { Atom, type AtomRegistry } from 'effect/reactivity';
import { IpcError } from '@/core/ipc';
import { prepareTranslationLanguagesAtom } from '@/core/translation-settings';
import { INVALID_TEXT } from '../helpers/lookup-copy';
import { normalizePhrase } from '../helpers/phrase';
import {
  draftAtom,
  draftContextAtom,
  lookupAtom,
  lookupCommandAtom,
  panelOpenAtom,
  selectionAtom,
} from './atoms';

type Registry = AtomRegistry.AtomRegistry;

function abandonLookup(registry: Registry) {
  registry.set(lookupCommandAtom, Atom.Interrupt);
  registry.set(lookupAtom, { tag: 'idle' });
}

export function resetTranslation(registry: Registry) {
  abandonLookup(registry);
  registry.set(prepareTranslationLanguagesAtom, Atom.Reset);
  registry.set(panelOpenAtom, false);
  registry.set(draftAtom, '');
  registry.set(draftContextAtom, undefined);
  registry.set(selectionAtom, undefined);
}

export function openPanel(registry: Registry) {
  abandonLookup(registry);
  registry.set(prepareTranslationLanguagesAtom, Atom.Reset);
  registry.set(draftAtom, '');
  registry.set(draftContextAtom, undefined);
  registry.set(selectionAtom, undefined);
  registry.set(panelOpenAtom, true);
}

export function closePanel(registry: Registry) {
  resetTranslation(registry);
}

export function changeDraft(registry: Registry, value: string) {
  abandonLookup(registry);
  registry.set(prepareTranslationLanguagesAtom, Atom.Reset);
  registry.set(draftAtom, value);
}

export function submitDraft(registry: Registry) {
  const text = normalizePhrase(registry.get(draftAtom));
  if (text === undefined) {
    registry.set(lookupAtom, {
      tag: 'failed',
      failure: new IpcError({ code: 'invalid_request', message: INVALID_TEXT }),
    });
    return;
  }
  const remembered = registry.get(draftContextAtom);
  const context = remembered?.text.toLowerCase() === text.toLowerCase() ? remembered.context : '';
  registry.set(prepareTranslationLanguagesAtom, Atom.Reset);
  registry.set(draftAtom, text);
  registry.set(lookupCommandAtom, { stage: 'translation', request: { text, context } });
}

export function translateSelection(registry: Registry) {
  const selection = registry.get(selectionAtom);
  if (selection === undefined) return;
  openPanel(registry);
  registry.set(draftAtom, selection.text);
  registry.set(draftContextAtom, { text: selection.text, context: selection.context });
  submitDraft(registry);
}

export function retryExplanation(registry: Registry) {
  registry.set(lookupCommandAtom, { stage: 'explanation' });
}

export function prepareLanguages(registry: Registry) {
  abandonLookup(registry);
  registry.set(prepareTranslationLanguagesAtom, undefined);
}
