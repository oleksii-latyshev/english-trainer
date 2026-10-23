import { Atom } from 'effect/reactivity';
import { captureRequestIdAtom, captureTimingAtom } from '@/core/answer-capture';
import type { SpeechTiming, StreamHandle } from '@/core/speech';
import type { PendingReply, SendFailure, SentAnswer } from '../types';

export type TurnOutcome =
  | { readonly tag: 'idle' }
  | { readonly tag: 'failed'; readonly failure: SendFailure };

export type RecordedOutcome = { readonly requestId: number; readonly outcome: TurnOutcome };

export const IDLE_OUTCOME: RecordedOutcome = { requestId: 0, outcome: { tag: 'idle' } };

export const outcomeRecordAtom = Atom.keepAlive(Atom.make<RecordedOutcome>(IDLE_OUTCOME));

export const pendingReplyAtom = Atom.keepAlive(Atom.make<PendingReply | null>(null));

export const generationAtom = Atom.keepAlive(Atom.make(0));

export const sendPendingAtom = Atom.keepAlive(Atom.make(false));

export const replyEndedAtom = Atom.keepAlive(Atom.make(0));

export const interruptingAtom = Atom.keepAlive(Atom.make(false));

export const replyVoiceAtom = Atom.keepAlive(Atom.make<StreamHandle | null>(null));

export const replyTimingAtom = Atom.keepAlive(Atom.make<SpeechTiming>({}));

export const voiceErrorAtom = Atom.keepAlive(Atom.make(''));

export const acceptedAnswerAtom = Atom.keepAlive(Atom.make<SentAnswer | null>(null));

export const turnLockAtom = Atom.keepAlive(Atom.make(false));

export const planningAtom = Atom.keepAlive(Atom.make(false));

export const micLevelAtom = Atom.keepAlive(Atom.make(0));

export const canVoiceInterruptAtom = Atom.keepAlive(Atom.make(false));

export const turnOutcomeAtom = Atom.make((get): TurnOutcome => {
  const record = get(outcomeRecordAtom);
  return record.requestId === get(captureRequestIdAtom) ? record.outcome : IDLE_OUTCOME.outcome;
});

export const sendFailureAtom = Atom.make((get) => {
  const outcome = get(turnOutcomeAtom);
  return outcome.tag === 'failed' ? outcome.failure : undefined;
});

export const speechTimingAtom = Atom.make(
  (get): SpeechTiming => ({ ...get(captureTimingAtom), ...get(replyTimingAtom) }),
);
