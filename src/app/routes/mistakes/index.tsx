import { RegistryContext, useAtom, useAtomValue } from '@effect/atom-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import { canChangeSessionAtom } from '@/core/answer-capture';
import { type RunTarget, usualRulesAtom } from '@/core/mistakes';
import {
  isSessionBusyAtom,
  isSessionOpenAtom,
  practiceErrorAtom,
  practiceStateAtom,
  startMistakePracticeAtom,
} from '@/core/practice-session';
import { startMistakeRunAtom } from '@/features/mistake-run';
import { MistakeRunScreen } from '@/screens/mistake-run';
import { MistakeCardScreen, MistakesScreen } from '@/screens/mistakes';
import { micBlockedReason } from './mic-blocked-reason';
import { talkBlockedReason } from './talk-blocked-reason';

function useStartRun() {
  const navigate = useNavigate();
  const [starting, start] = useAtom(startMistakeRunAtom);
  return {
    isStartingRun: AsyncResult.isWaiting(starting),
    onPractise: (target: RunTarget) =>
      start({
        target,
        onStarted: (runId) =>
          void navigate({ to: '/mistakes/practice/$runId', params: { runId: String(runId) } }),
      }),
  };
}

export function MistakesRoute() {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const isSessionOpen = useAtomValue(isSessionOpenAtom);
  const practiceTag = useAtomValue(practiceStateAtom).tag;
  const practiceError = useAtomValue(practiceErrorAtom);
  const usual = useAtomValue(usualRulesAtom);
  const run = useStartRun();

  return (
    <MistakesScreen
      isStartingRun={run.isStartingRun}
      isStartingTalk={practiceTag === 'starting'}
      onOpenMistake={(id) =>
        void navigate({ to: '/mistakes/$mistakeId', params: { mistakeId: String(id) } })
      }
      onPractise={run.onPractise}
      onTalkItThrough={() => registry.set(startMistakePracticeAtom, undefined)}
      talkBlockedReason={talkBlockedReason(usual, {
        isSessionOpen,
        isAudioBusy: isBusy || !canChangeSession,
      })}
      talkError={practiceError}
    />
  );
}

export function MistakeCardRoute() {
  const navigate = useNavigate();
  const { mistakeId } = useParams({ from: '/mistakes/$mistakeId' });
  const run = useStartRun();
  return (
    <MistakeCardScreen
      isStartingRun={run.isStartingRun}
      mistakeId={Number(mistakeId)}
      onBack={() => void navigate({ to: '/mistakes' })}
      onPractise={run.onPractise}
    />
  );
}

export function MistakeRunRoute() {
  const navigate = useNavigate();
  const { runId } = useParams({ from: '/mistakes/practice/$runId' });
  const isBusy = useAtomValue(isSessionBusyAtom);
  const isSessionOpen = useAtomValue(isSessionOpenAtom);
  return (
    <MistakeRunScreen
      micBlockedReason={micBlockedReason({
        isSessionOpen,
        isAudioBusy: isBusy,
      })}
      onLeave={() => void navigate({ to: '/mistakes' })}
      runId={Number(runId)}
    />
  );
}
