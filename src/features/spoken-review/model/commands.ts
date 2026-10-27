import type { AtomRegistry } from 'effect/reactivity';
import type { LearningItemRef } from '@/core/learning-memory';
import { createPlayback } from '@/core/speech';
import type { ReviewFix } from '../helpers/review-issue';
import { cancelPractice, startPractice } from '../helpers/review-session';
import type { ReviewMode } from '../types';
import { saveAgainAtom, transcribeAgainAtom } from './answer-atoms';
import {
  cancelAnswer,
  finishAnswer,
  resetAnswer,
  startAnswer,
  stopSpeech,
} from './answer-controls';
import { beginReview } from './begin-review';
import { retryMaterialsAtom, revealPhraseAtom } from './materials-atoms';
import { phaseAtom, promptAtom } from './prompt-atoms';
import { endReviewAtom, finishAtom, nextAtom, skipAtom } from './review-actions';
import { sessionAtom } from './session-atoms';

export type ReviewCommands = ReturnType<typeof reviewCommands>;

export function reviewCommands(registry: AtomRegistry.AtomRegistry) {
  function startPracticeTry() {
    const session = registry.get(sessionAtom);
    if (session === null) return;
    stopSpeech(registry);
    registry.set(sessionAtom, startPractice(session));
    startAnswer(registry);
  }

  function pressSecondary() {
    const session = registry.get(sessionAtom);
    if (session === null) return;
    if (session.step.tag !== 'result') {
      registry.set(skipAtom, undefined);
      return;
    }
    resetAnswer(registry);
    registry.set(sessionAtom, cancelPractice(session));
  }

  function fix(kind: ReviewFix, onOpenSettings: () => void) {
    switch (kind) {
      case 'transcribe-again':
        registry.set(transcribeAgainAtom, undefined);
        return;
      case 'record-again':
        resetAnswer(registry);
        return;
      case 'open-settings':
        onOpenSettings();
        return;
      case 'save-again':
        registry.set(saveAgainAtom, undefined);
        return;
      case 'skip-again':
        registry.set(skipAtom, undefined);
        return;
      case 'finish-again':
        registry.set(finishAtom, undefined);
        return;
    }
  }

  return {
    begin: (mode: ReviewMode) => beginReview(registry, mode),
    beginItem: (target: LearningItemRef) => beginReview(registry, 'review', target),
    pressMic: () => {
      if (registry.get(phaseAtom) === 'listening') finishAnswer(registry);
      else startAnswer(registry);
    },
    startAnswer: () => startAnswer(registry),
    finishAnswer: () => finishAnswer(registry),
    cancelAnswer: () => cancelAnswer(registry),
    stopSpeech: () => stopSpeech(registry),
    replay: () => {
      const prompt = registry.get(promptAtom);
      if (prompt !== null) createPlayback(registry).play(prompt.spoken);
    },
    playExample: (text: string) => createPlayback(registry).play(text),
    practice: startPracticeTry,
    pressSecondary,
    fix,
    next: () => registry.set(nextAtom, undefined),
    skip: () => registry.set(skipAtom, undefined),
    finish: () => registry.set(finishAtom, undefined),
    end: (onDone: () => void) => registry.set(endReviewAtom, onDone),
    revealPhrase: () => registry.set(revealPhraseAtom, undefined),
    retryMaterials: () => registry.set(retryMaterialsAtom, undefined),
  };
}
