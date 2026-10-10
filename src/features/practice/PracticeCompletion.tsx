import { Button } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { showSavedToast } from '@/components/savedToast';
import { deletePhraseCard } from '@/features/memory/memoryApi';
import type { FinishedPracticeSession } from '@/lib/finishedPracticeSession';
import {
  DEFAULT_PRACTICE_MODE,
  defaultPracticePhase,
  practiceModeLabel,
  practicePhaseLabel,
} from '@/lib/practiceOptions';
import { isProviderError } from '@/lib/types';
import { checkingLine, formatDuration } from './lib/wrapup';
import { getSessionWrapup, retrySessionWrapup, saveWrapupPhrases } from './sessionApi';
import { useWrapupUpdates } from './useWrapupUpdates';
import {
  MistakesSection,
  PhraseSection,
  type PhraseSelection,
  type SaveState,
  Stats,
} from './WrapupSections';
import './wrapup.css';

type Props = {
  summary: FinishedPracticeSession;
  onDone: () => void;
  onTalkMore: () => void;
  /** The wrap-up read again after more coaching landed. */
  onSummaryUpdated: (summary: FinishedPracticeSession) => void;
};

type CurrentSession = { mounted: boolean; sessionId: number };

function isCurrentSession(current: CurrentSession, sessionId: number): boolean {
  return current.mounted && current.sessionId === sessionId;
}

function retryMessage(cause: unknown): string {
  return isProviderError(cause) ? cause.message : 'Could not prepare phrases. Please retry.';
}

async function performPhraseRetry(
  sessionId: number,
  onSuccess: (summary: FinishedPracticeSession) => void,
  onFailure: (message: string) => void,
  onFinished: () => void,
): Promise<void> {
  try {
    await retrySessionWrapup(sessionId);
    onSuccess(await getSessionWrapup(sessionId));
  } catch (cause: unknown) {
    onFailure(retryMessage(cause));
  } finally {
    onFinished();
  }
}

function sessionLabel(summary: FinishedPracticeSession): string {
  if (summary.is_mistake_practice) {
    return `Usual mistakes practice · ${formatDuration(summary.duration_ms)}`;
  }
  const mode = practiceModeLabel(summary.practice_mode ?? DEFAULT_PRACTICE_MODE);
  const phase = practicePhaseLabel(
    summary.practice_phase ?? defaultPracticePhase(summary.practice_mode ?? DEFAULT_PRACTICE_MODE),
  );
  return `${summary.topic_label} · ${mode} · ${phase} · ${formatDuration(summary.duration_ms)}`;
}

export function PracticeCompletion({ summary, onDone, onTalkMore, onSummaryUpdated }: Props) {
  useWrapupUpdates(summary, onSummaryUpdated);
  const [selection, setSelection] = useState<{
    sessionId: number;
    removed: ReadonlySet<string>;
    saved: ReadonlySet<string>;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ sessionId: number; state: SaveState } | null>(
    null,
  );
  const [retryingSession, setRetryingSession] = useState<number | null>(null);
  const [retryMessageState, setRetryMessageState] = useState<{
    sessionId: number;
    message: string;
  } | null>(null);
  const current = useRef<CurrentSession>({ mounted: false, sessionId: summary.session_id });
  current.current.sessionId = summary.session_id;
  useEffect(() => {
    current.current.mounted = true;
    return () => {
      current.current.mounted = false;
    };
  }, []);

  const removed =
    selection?.sessionId === summary.session_id ? selection.removed : new Set<string>();
  const saved = selection?.sessionId === summary.session_id ? selection.saved : new Set<string>();
  const saveState = saveStatus?.sessionId === summary.session_id ? saveStatus.state : 'idle';
  const phrases = summary.phrases.filter((item) => !removed.has(item.phrase));
  const toSave = phrases.filter((item) => !saved.has(item.phrase));
  const isSaved = phrases.length > 0 && toSave.length === 0;
  const checking = checkingLine(summary.pending_coaching, summary.is_coaching_paused);
  const canRetry = retryingSession === summary.session_id;
  const retryMessageForSession =
    retryMessageState?.sessionId === summary.session_id ? retryMessageState.message : undefined;

  function updateSelection(update: (value: PhraseSelection) => PhraseSelection) {
    setSelection((previous) => {
      const isSameSession = previous?.sessionId === summary.session_id;
      const value = {
        removed: isSameSession ? previous.removed : new Set<string>(),
        saved: isSameSession ? previous.saved : new Set<string>(),
      };
      return { sessionId: summary.session_id, ...update(value) };
    });
  }

  async function handleSaveAll() {
    if (toSave.length === 0 || saveState === 'saving') return;
    const sessionId = summary.session_id;
    const savedNow = toSave.map((item) => item.phrase);
    setSaveStatus({ sessionId, state: 'saving' });
    try {
      const result = await saveWrapupPhrases(sessionId, savedNow);
      if (!isCurrentSession(current.current, sessionId)) return;
      updateSelection((value) => ({ ...value, saved: new Set([...value.saved, ...savedNow]) }));
      setSaveStatus({ sessionId, state: 'saved' });
      showSavedToast({
        onUndo:
          result.created_ids.length > 0
            ? async () => {
                await Promise.all(result.created_ids.map((id) => deletePhraseCard(id)));
                if (!isCurrentSession(current.current, sessionId)) return;
                updateSelection((value) => ({
                  ...value,
                  saved: new Set([...value.saved].filter((phrase) => !savedNow.includes(phrase))),
                }));
                setSaveStatus({ sessionId, state: 'idle' });
              }
            : undefined,
      });
    } catch {
      if (isCurrentSession(current.current, sessionId))
        setSaveStatus({ sessionId, state: 'error' });
    }
  }

  async function handleRetryPhrases() {
    const sessionId = summary.session_id;
    setRetryingSession(sessionId);
    setRetryMessageState(null);
    await performPhraseRetry(
      sessionId,
      (fresh) => {
        if (isCurrentSession(current.current, sessionId)) onSummaryUpdated(fresh);
      },
      (message) => {
        if (isCurrentSession(current.current, sessionId)) {
          setRetryMessageState({ sessionId, message });
        }
      },
      () => {
        if (isCurrentSession(current.current, sessionId)) setRetryingSession(null);
      },
    );
  }

  return (
    <div className="wrapup">
      <header className="wrapup-header">
        <div className="wrapup-header-copy">
          <div className="wrapup-subtitle">{sessionLabel(summary)}</div>
          <h1>Nice session. Here’s what to keep.</h1>
        </div>
        <div className="wrapup-header-actions">
          <Button onPress={onTalkMore} variant="secondary">
            Talk more
          </Button>
          <Button onPress={onDone} variant="primary">
            Done
          </Button>
        </div>
      </header>

      <Stats numbers={summary.numbers} />
      <div className="wrapup-columns">
        <PhraseSection
          checking={checking}
          onRemove={(phrase) =>
            updateSelection((value) => ({ ...value, removed: new Set([...value.removed, phrase]) }))
          }
          onRetry={() => void handleRetryPhrases()}
          phrases={phrases}
          retryMessage={retryMessageForSession}
          retrying={canRetry}
          selection={{ removed, saved }}
          summary={summary}
        />
        <MistakesSection
          checking={checking}
          isSaved={isSaved}
          onSave={() => void handleSaveAll()}
          saveState={saveState}
          summary={summary}
          toSaveCount={toSave.length}
        />
      </div>
    </div>
  );
}
