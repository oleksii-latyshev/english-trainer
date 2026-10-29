import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useContext } from 'react';
import { canChangeSessionAtom } from '@/core/answer-capture';
import { dueMemory, learningMemoryAtom } from '@/core/learning-memory';
import {
  isSessionBusyAtom,
  isSessionOpenAtom,
  practiceErrorAtom,
  practiceStateAtom,
  startMistakePracticeAtom,
} from '@/core/practice-session';
import { MistakeCardScreen, MistakesScreen } from '@/screens/mistakes';
import { talkBlockedReason } from './talk-blocked-reason';

export function MistakesRoute() {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const isSessionOpen = useAtomValue(isSessionOpenAtom);
  const practiceTag = useAtomValue(practiceStateAtom).tag;
  const practiceError = useAtomValue(practiceErrorAtom);
  const due = dueMemory(useAtomValue(learningMemoryAtom));

  return (
    <MistakesScreen
      isStartingTalk={practiceTag === 'starting'}
      onOpenMistake={(id) =>
        void navigate({ to: '/mistakes/$mistakeId', params: { mistakeId: String(id) } })
      }
      onTalkItThrough={() => registry.set(startMistakePracticeAtom, undefined)}
      talkBlockedReason={talkBlockedReason(due, {
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
  return (
    <MistakeCardScreen
      mistakeId={Number(mistakeId)}
      onBack={() => void navigate({ to: '/mistakes' })}
    />
  );
}
