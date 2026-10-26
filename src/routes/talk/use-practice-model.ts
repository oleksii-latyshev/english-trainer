import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  canChangeSessionAtom,
  captureRequestIdAtom,
  captureStateAtom,
  captureTimingAtom,
} from '@/core/answer-capture';
import { microphoneSnapshotAtom } from '@/core/audio';
import { isSessionBusyAtom, practiceErrorAtom, practiceStateAtom } from '@/core/practice-session';
import type { PracticeViewModel } from '@/features/practice/practiceViewModel';
import { captureViewOf } from './capture-view';

const OFF = { status: 'off', error: '' } as const;

export function usePracticeModel(): PracticeViewModel {
  const capture = useAtomValue(captureStateAtom);
  const timing = useAtomValue(captureTimingAtom);
  const requestId = useAtomValue(captureRequestIdAtom);
  const microphone = AsyncResult.getOrElse(useAtomValue(microphoneSnapshotAtom), () => OFF);
  const practice = useAtomValue(practiceStateAtom);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const view = captureViewOf(capture, timing, requestId, microphone);
  return {
    ...view,
    practice,
    practiceError: useAtomValue(practiceErrorAtom),
    busy: isBusy || view.status === 'requesting' || view.status === 'stopping',
    canChangeSession,
  };
}
