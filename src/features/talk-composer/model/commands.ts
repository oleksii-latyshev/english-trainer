import { Atom, type AtomRegistry } from 'effect/reactivity';
import { stopListening, transcribeAgain } from '@/core/answer-capture';
import { interruptReply, resumeMicrophone } from '@/core/practice-turn';
import { resolveInputSource } from '../helpers/input-source';
import type { TurnFix } from '../helpers/turn-issue';
import type { TurnState } from '../helpers/turn-state';
import { draftAtom } from './draft-atoms';
import { countdownAtom, submitAtom, switchToAppleAndRetryAtom } from './submit';
import { turnStateAtom } from './view-atoms';

export type FixHandlers = {
  readonly onOpenSettings: () => void;
  readonly onChooseMicrophone: () => void;
};

export function cancelCountdown(registry: AtomRegistry.AtomRegistry) {
  registry.set(countdownAtom, Atom.Interrupt);
}

export function startAnswer(registry: AtomRegistry.AtomRegistry) {
  cancelCountdown(registry);
  interruptReply(registry, { record: true, retainPreRoll: false });
}

export function stopEva(registry: AtomRegistry.AtomRegistry) {
  interruptReply(registry, { record: false, retainPreRoll: false });
}

export function changeDraft(registry: AtomRegistry.AtomRegistry, text: string) {
  cancelCountdown(registry);
  registry.update(draftAtom, (draft) => ({ ...draft, text }));
}

function currentSubmission(registry: AtomRegistry.AtomRegistry) {
  const draft = registry.get(draftAtom);
  return { text: draft.text, source: resolveInputSource({ draft: draft.text, ...draft }) };
}

export function sendDraft(registry: AtomRegistry.AtomRegistry) {
  cancelCountdown(registry);
  registry.set(submitAtom, currentSubmission(registry));
}

export function pressMic(registry: AtomRegistry.AtomRegistry) {
  const state: TurnState = registry.get(turnStateAtom);
  if (state.tag === 'listening' || state.tag === 'auto-listen') stopListening(registry);
  else if (state.tag === 'paused') resumeMicrophone(registry);
  else startAnswer(registry);
}

export function runFix(registry: AtomRegistry.AtomRegistry, fix: TurnFix, handlers: FixHandlers) {
  switch (fix) {
    case 'retry-send':
      sendDraft(registry);
      return;
    case 'switch-to-apple':
      registry.set(switchToAppleAndRetryAtom, currentSubmission(registry));
      return;
    case 'transcribe-again':
      transcribeAgain(registry);
      return;
    case 'record-again':
      startAnswer(registry);
      return;
    case 'open-settings':
      handlers.onOpenSettings();
      return;
    case 'choose-microphone':
      handlers.onChooseMicrophone();
      return;
    case 'resume-mic':
      resumeMicrophone(registry);
      return;
  }
}
