import { useAtomValue } from '@effect/atom-react';
import type { ReactNode } from 'react';
import { captureStateAtom } from '@/core/answer-capture';
import { isSessionBusyAtom, practiceStateAtom, type SessionDetails } from '@/core/practice-session';
import { AnswerHelp } from '@/features/answer-help';
import { Rescue } from '@/features/rescue';
import { useTurn } from '@/features/talk-composer';
import { canHelp, hasRescue } from '../helpers/availability';
import type { TalkGuards } from './use-talk-guards';

type Slots = { readonly helpBar: ReactNode; readonly rescueControl: ReactNode };

export function useComposerSlots(session: SessionDetails, guards: TalkGuards): Slots {
  const practice = useAtomValue(practiceStateAtom);
  const capture = useAtomValue(captureStateAtom);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const turn = useTurn();
  const isOccupied = guards.isRetrying || guards.isRecalling;
  const isAvailable = canHelp(session, isOccupied);
  const isCaptureBusy = capture.tag === 'requesting' || capture.tag === 'stopping';
  const isDisabled = [
    isBusy || isCaptureBusy,
    practice.tag !== 'active',
    turn.isSending,
    capture.tag === 'transcribing',
    isOccupied,
    guards.isStageLocked,
  ].some(Boolean);
  return {
    helpBar: isAvailable ? <AnswerHelp isDisabled={isDisabled} /> : undefined,
    rescueControl:
      isAvailable && hasRescue(session) && capture.tag === 'recording' ? <Rescue /> : undefined,
  };
}
