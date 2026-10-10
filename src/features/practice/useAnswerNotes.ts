import { useState } from 'react';
import { latestPausedSequence } from '@/features/coach/lib/note';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import type { NoteTools } from './AnswerNote';
import type { SessionDetails } from './lib/practiceState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { retryAnswerCoaching } from './sessionApi';
import type { useSecondTry } from './useSecondTry';

type Options = {
  session?: SessionDetails;
  dialogue: PracticeDialogue | null;
  secondTry: ReturnType<typeof useSecondTry>;
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  retryHistory: () => void;
};

export function useAnswerNotes({
  session,
  dialogue,
  secondTry,
  model,
  actions,
  speech,
  retryHistory,
}: Options) {
  const [saved, setSaved] = useState<{ sessionId: number; sequence: number } | null>(null);
  const noteTools: NoteTools | null = session
    ? {
        sessionId: session.sessionId,
        turnCount: session.turnCount,
        retryEvidence: session.retryEvidence,
        secondTrySequence: secondTry.sequence,
        secondTryStatus: secondTry.status,
        latestPausedSequence: latestPausedSequence(dialogue?.coaching),
        model,
        actions,
        onSayAgain: secondTry.start,
        onCancelSecondTry: secondTry.cancel,
        onRetryCoaching: (sequence) => {
          void retryAnswerCoaching(session.sessionId, sequence)
            .catch((cause: unknown) =>
              console.warn('Could not ask for the coaching of this answer again.', cause),
            )
            .finally(retryHistory);
        },
        onSpeak: speech.play,
        onPhraseSaved: (sequence) => setSaved({ sessionId: session.sessionId, sequence }),
        onPhraseSaveUndone: (sequence) =>
          setSaved((current) =>
            current?.sessionId === session.sessionId && current.sequence === sequence
              ? null
              : current,
          ),
      }
    : null;
  return {
    noteTools,
    isPhraseSaved:
      saved?.sessionId === session?.sessionId &&
      saved?.sequence === session?.turnCount &&
      saved !== null,
  };
}
