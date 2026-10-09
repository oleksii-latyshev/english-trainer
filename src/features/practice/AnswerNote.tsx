import { useState } from 'react';
import { showSavedToast } from '@/components/savedToast';
import { CoachingNote, type PhraseSaveState } from '@/features/coach/CoachingNote';
import { isNoteOpen, noteView, phraseToSave } from '@/features/coach/lib/note';
import { deletePhraseCard, savePhraseCard } from '@/features/memory/memoryApi';
import type { TurnCoaching } from '@/lib/coachingTypes';
import { newlySavedCards } from '@/lib/savedPhrases';
import type { AttemptComparison } from '@/lib/types';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { SecondTryBox } from './SecondTryBox';
import type { SecondTryStatus } from './useSecondTry';

/** What every coaching note needs from the Talk screen. */
export type NoteTools = {
  sessionId: number;
  /** Answers given so far; the newest answer's note is the one that starts open. */
  turnCount: number;
  retryEvidence: AttemptComparison[];
  /** The answer being re-spoken now. */
  secondTrySequence: number | null;
  secondTryStatus: SecondTryStatus;
  /** Only the newest paused answer says coaching is paused; older ones stay quiet. */
  latestPausedSequence: number | null;
  model: PracticeViewModel;
  actions: PracticeActions;
  onSayAgain: (sequence: number) => void;
  onCancelSecondTry: () => void;
  onRetryCoaching: (sequence: number) => void;
  onSpeak: (text: string) => void;
  onPhraseSaved: (sequence: number) => void;
  onPhraseSaveUndone: (sequence: number) => void;
};

type Props = {
  sequence: number;
  transcript: string;
  coaching: TurnCoaching;
  tools: NoteTools;
  /** Reviews keep every answer's coaching visible at once. */
  isPinnedOpen?: boolean;
};

/** The coaching note under one answer, with its own open state and phrase saving. */
export function AnswerNote({ sequence, transcript, coaching, tools, isPinnedOpen = false }: Props) {
  // The learner's choice holds only until the next turn starts, which collapses every note.
  const [choice, setChoice] = useState<{ turnCount: number; isOpen: boolean } | null>(null);
  const [phraseSaveState, setPhraseSaveState] = useState<PhraseSaveState>('idle');
  const view = noteView(coaching);
  if (view.tag === 'paused' && tools.latestPausedSequence !== sequence) return null;

  const override = choice?.turnCount === tools.turnCount ? choice.isOpen : undefined;
  const isOpen = override ?? (isPinnedOpen || isNoteOpen(undefined, sequence, tools.turnCount));
  const toSave = view.tag === 'ready' ? phraseToSave(view.feedback) : null;
  const evidence = tools.retryEvidence.find((item) => item.turn_sequence === sequence);

  async function handleSavePhrase() {
    if (!toSave || phraseSaveState === 'saving') return;
    setPhraseSaveState('saving');
    try {
      const requestedAtMs = Date.now();
      const card = await savePhraseCard(toSave.phrase, toSave.note, tools.sessionId, sequence);
      setPhraseSaveState('saved');
      const [created] = newlySavedCards([card], requestedAtMs);
      showSavedToast({
        onUndo: created
          ? async () => {
              await deletePhraseCard(created.id);
              setPhraseSaveState('idle');
              tools.onPhraseSaveUndone(sequence);
            }
          : undefined,
      });
      tools.onPhraseSaved(sequence);
    } catch {
      setPhraseSaveState('error');
    }
  }

  return (
    <CoachingNote
      canSavePhrase={toSave !== null}
      isOpen={isOpen}
      isSayAgainDisabled={
        tools.secondTrySequence !== null ||
        tools.model.busy ||
        tools.model.practice.tag !== 'active' ||
        tools.model.status === 'recording'
      }
      onRetryCoaching={() => tools.onRetryCoaching(sequence)}
      onSavePhrase={() => void handleSavePhrase()}
      onSayAgain={() => tools.onSayAgain(sequence)}
      onSpeakRewrite={tools.onSpeak}
      onToggle={() => setChoice({ turnCount: tools.turnCount, isOpen: !isOpen })}
      phraseSaveState={phraseSaveState}
      secondTry={
        view.tag === 'ready' && (
          <SecondTryBox
            actions={tools.actions}
            cue={view.feedback.b2_rewrite}
            evidence={evidence}
            isActive={tools.secondTrySequence === sequence}
            model={tools.model}
            onCancel={tools.onCancelSecondTry}
            status={tools.secondTryStatus}
          />
        )
      }
      transcript={transcript}
      view={view}
    />
  );
}
