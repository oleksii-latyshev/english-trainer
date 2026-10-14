import { Atom } from 'effect/reactivity';
import { describeResult, type ResultView } from '../helpers/result-view';
import { type ReviewIssue, reviewIssue } from '../helpers/review-issue';
import {
  type ReviewMicCopy,
  resultEvaMood,
  reviewEvaMood,
  reviewMicCopy,
} from '../helpers/review-phase';
import { isAnswering, isBusy, isTryingAgain } from '../helpers/review-session';
import { itemKey } from '../helpers/status-before';
import { captureOutcomeAtom, capturePhaseAtom, liveTextAtom } from './capture-state';
import { isEvaSpeakingAtom, phaseAtom } from './prompt-atoms';
import { sessionAtom, shownItemAtom, statusBeforeAtom } from './session-atoms';

export const isAnsweringAtom = Atom.make((get) => {
  const session = get(sessionAtom);
  return session !== null && isAnswering(session);
});

export const isSummaryAtom = Atom.make((get) => get(sessionAtom)?.step.tag === 'summary');

export const isTryingAgainAtom = Atom.make((get) => {
  const session = get(sessionAtom);
  return session !== null && isTryingAgain(session);
});

export const isBusyAtom = Atom.make((get) => {
  const session = get(sessionAtom);
  return session !== null && isBusy(session);
});

export const isEndingAtom = Atom.make((get) => get(sessionAtom)?.pending === 'finishing');

export const issueAtom = Atom.make((get): ReviewIssue | null => {
  const outcome = get(captureOutcomeAtom);
  return reviewIssue({
    actionError: get(sessionAtom)?.actionError ?? null,
    transcriptionFailure: outcome.tag === 'transcription-failed' ? outcome.recovery : undefined,
    captureError: outcome.tag === 'microphone-failed' ? outcome.message : '',
  });
});

export const micCopyAtom = Atom.make(
  (get): ReviewMicCopy =>
    reviewMicCopy(get(phaseAtom), get(isEvaSpeakingAtom), get(isTryingAgainAtom)),
);

export const levelAtom = Atom.make((get) => {
  const phase = get(capturePhaseAtom);
  return phase.tag === 'recording' ? phase.level : 0;
});

export const livePreviewAtom = Atom.make((get) =>
  get(phaseAtom) === 'listening' ? get(liveTextAtom) : '',
);

export const isSecondaryDisabledAtom = Atom.make((get) => {
  const phase = get(phaseAtom);
  return get(isBusyAtom) || phase === 'transcribing' || phase === 'starting';
});

export const resultViewAtom = Atom.make((get): ResultView | null => {
  const session = get(sessionAtom);
  if (
    session === null ||
    session.step.tag !== 'result' ||
    session.step.attempt.tag === 'recording'
  ) {
    return null;
  }
  const { result, attempt } = session.step;
  const before = get(statusBeforeAtom).get(itemKey(result.item_type, result.item_id)) ?? null;
  return describeResult(result, attempt, before);
});

export const evaMoodAtom = Atom.make((get) => {
  const result = get(resultViewAtom);
  if (result !== null) return resultEvaMood(result.tone === 'used');
  return reviewEvaMood(get(phaseAtom), get(isEvaSpeakingAtom));
});

export const contextStatusAtom = Atom.make((get) => {
  const session = get(sessionAtom);
  const item = get(shownItemAtom);
  if (item === null) return null;
  if (session?.step.tag === 'result') return session.step.result.status;
  return get(statusBeforeAtom).get(itemKey(item.item_type, item.item_id)) ?? null;
});
