import { Atom } from 'effect/reactivity';
import { captureStateAtom } from '@/core/answer-capture';
import { sessionDetailsAtom } from '@/core/practice-session';
import { isAnswerCaptureStarted, isAnswerRecording } from '../helpers/example-guard';
import { helpKeyOf } from '../helpers/help-key';
import type { HelpLevel } from '../helpers/help-levels';
import type { HelpChoice, HelpNotice, PlanningTimer, PlanState } from '../types';

const NO_CHOICE: HelpChoice = { key: 'none', level: null };

export const helpKeyAtom = Atom.make((get) => helpKeyOf(get(sessionDetailsAtom)));

export const helpChoiceAtom = Atom.keepAlive(Atom.make<HelpChoice>(NO_CHOICE));

export const helpLevelAtom = Atom.make((get): HelpLevel | null => {
  const choice = get(helpChoiceAtom);
  return choice.key === get(helpKeyAtom) ? choice.level : null;
});

export const helpNoticeStoreAtom = Atom.keepAlive(Atom.make<HelpNotice | null>(null));

export const helpNoticeAtom = Atom.make((get) => {
  const notice = get(helpNoticeStoreAtom);
  return notice !== null && notice.key === get(helpKeyAtom) ? notice.text : null;
});

export const helpRequestAtom = Atom.keepAlive(Atom.make(0));

export const requestedLevelAtom = Atom.keepAlive(Atom.make<HelpLevel | null>(null));

export const captureEpochAtom = Atom.keepAlive(Atom.make(0));

export const wasCapturingAtom = Atom.keepAlive(Atom.make(false));

export const isCaptureStartedAtom = Atom.make((get) =>
  isAnswerCaptureStarted(get(captureStateAtom)),
);

export const isRecordingAtom = Atom.make((get) => isAnswerRecording(get(captureStateAtom)));

export const planStoreAtom = Atom.keepAlive(Atom.make<PlanState | null>(null));

export const planRequestAtom = Atom.keepAlive(Atom.make(0));

export const planAtom = Atom.make((get): PlanState => {
  const stored = get(planStoreAtom);
  const key = get(helpKeyAtom);
  return stored !== null && stored.key === key ? stored : { tag: 'loading', key };
});

export const planningTimerAtom = Atom.keepAlive(Atom.make<PlanningTimer | null>(null));

export const remainingSecondsAtom = Atom.keepAlive(Atom.make(0));
