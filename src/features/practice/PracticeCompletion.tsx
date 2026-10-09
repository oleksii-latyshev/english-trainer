import { Button } from '@heroui/react';
import { Bookmark, Check, X } from 'lucide-react';
import { useState } from 'react';
import { showSavedToast } from '@/components/savedToast';
import { deletePhraseCard, savePhraseCard } from '@/features/memory/memoryApi';
import type {
  FinishedPracticeSession,
  RecurringMistake,
  Trend,
  WrapupPhrase,
} from '@/lib/finishedPracticeSession';
import { newlySavedCards } from '@/lib/savedPhrases';
import { checkingLine, formatDuration, savePhrasesLabel, trendLine } from './lib/wrapup';
import { useWrapupUpdates } from './useWrapupUpdates';
import './wrapup.css';

type Props = {
  summary: FinishedPracticeSession;
  onDone: () => void;
  onTalkMore: () => void;
  /** The wrap-up read again after more coaching landed. */
  onSummaryUpdated: (summary: FinishedPracticeSession) => void;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function StatCard(props: { label: string; value: string; trend: Trend; emptyHint: string }) {
  const hasValue = props.value !== '—';
  const line = hasValue
    ? trendLine(props.trend)
    : { text: props.emptyHint, tone: 'quiet' as const };
  return (
    <div className="wrapup-card wrapup-stat">
      <div className="wrapup-stat-label">{props.label}</div>
      <div className="wrapup-stat-value">{props.value}</div>
      <div className="wrapup-stat-trend" data-tone={line.tone}>
        {line.text}
      </div>
    </div>
  );
}

function Stats({ numbers }: { numbers: FinishedPracticeSession['numbers'] }) {
  const { speaking_time, words_per_minute, average_answer } = numbers;
  return (
    <div className="wrapup-stats">
      <StatCard
        emptyHint="no spoken answers to time"
        label="Speaking time"
        trend={speaking_time.trend}
        value={speaking_time.duration_ms === null ? '—' : formatDuration(speaking_time.duration_ms)}
      />
      <StatCard
        emptyHint="needs a spoken answer"
        label="Words per minute"
        trend={words_per_minute.trend}
        value={words_per_minute.value === null ? '—' : String(words_per_minute.value)}
      />
      <StatCard
        emptyHint="no answers yet"
        label="Average answer"
        trend={average_answer.trend}
        value={
          average_answer.words === null
            ? '—'
            : `${average_answer.words} ${average_answer.words === 1 ? 'word' : 'words'}`
        }
      />
    </div>
  );
}

function SectionHeading(props: { id: string; title: string; count: number }) {
  return (
    <div className="wrapup-heading">
      <h2 id={props.id}>{props.title}</h2>
      <span>{props.count}</span>
    </div>
  );
}

function PhraseCard(props: { phrase: WrapupPhrase; canRemove: boolean; onRemove: () => void }) {
  return (
    <div className="wrapup-card wrapup-phrase">
      <div className="wrapup-phrase-copy">
        <div className="wrapup-phrase-text">{props.phrase.phrase}</div>
        <div className="wrapup-phrase-source">You said: “{props.phrase.you_said}”</div>
      </div>
      {props.canRemove && (
        <Button
          aria-label={`Remove phrase “${props.phrase.phrase}”`}
          isIconOnly
          onPress={props.onRemove}
          size="sm"
          variant="ghost"
        >
          <X aria-hidden="true" size={16} strokeWidth={2} />
        </Button>
      )}
    </div>
  );
}

function MistakeCard({ mistake }: { mistake: RecurringMistake }) {
  return (
    <div className="wrapup-card wrapup-mistake">
      <div className="wrapup-mistake-change">
        <span className="wrapup-strike">{mistake.original}</span> →{' '}
        <span className="wrapup-highlight">{mistake.improved}</span>
      </div>
      <div className="wrapup-mistake-rule">
        {mistake.explanation} · {mistake.times} times today
      </div>
    </div>
  );
}

export function PracticeCompletion({ summary, onDone, onTalkMore, onSummaryUpdated }: Props) {
  useWrapupUpdates(summary, onSummaryUpdated);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const phrases = summary.phrases.filter((item) => !removed.has(item.phrase));
  // Phrases that land after a save are still to be saved, so "saved" is tracked per phrase.
  const toSave = phrases.filter((item) => !saved.has(item.phrase));
  const isSaved = phrases.length > 0 && toSave.length === 0;
  const checking = checkingLine(summary.pending_coaching, summary.is_coaching_paused);

  async function handleSaveAll() {
    if (toSave.length === 0 || saveState === 'saving') return;
    setSaveState('saving');
    const requestedAtMs = Date.now();
    try {
      const cards = [];
      for (const item of toSave) {
        cards.push(await savePhraseCard(item.phrase, item.note, summary.session_id, item.sequence));
      }
      const savedNow = toSave.map((item) => item.phrase);
      setSaved((current) => new Set([...current, ...savedNow]));
      setSaveState('saved');
      const created = newlySavedCards(cards, requestedAtMs);
      showSavedToast({
        onUndo:
          created.length > 0
            ? async () => {
                await Promise.all(created.map((card) => deletePhraseCard(card.id)));
                setSaved((current) => new Set([...current].filter((p) => !savedNow.includes(p))));
                setSaveState('idle');
              }
            : undefined,
      });
    } catch {
      // A phrase that did get saved is skipped as a duplicate when the learner retries.
      setSaveState('error');
    }
  }

  return (
    <div className="wrapup">
      <header className="wrapup-header">
        <div className="wrapup-header-copy">
          <div className="wrapup-subtitle">
            {summary.topic_label} · {formatDuration(summary.duration_ms)}
          </div>
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
        <section aria-labelledby="wrapup-phrases" className="wrapup-section">
          <SectionHeading
            count={phrases.length}
            id="wrapup-phrases"
            title="Phrases worth learning"
          />
          {phrases.map((item) => (
            <PhraseCard
              canRemove={!isSaved}
              key={item.phrase}
              onRemove={() => setRemoved(new Set(removed).add(item.phrase))}
              phrase={item}
            />
          ))}
          {phrases.length === 0 && (
            <p className="wrapup-empty">
              {summary.phrases.length === 0
                ? 'Phrases appear here when Eva coaches an answer.'
                : 'All phrases removed. Nothing will be saved from this session.'}
            </p>
          )}
          {checking && <p className="wrapup-note">{checking}</p>}
        </section>

        <section aria-labelledby="wrapup-mistakes" className="wrapup-section">
          <SectionHeading
            count={summary.recurring_mistakes.length}
            id="wrapup-mistakes"
            title="Came up more than once"
          />
          {summary.recurring_mistakes.map((mistake) => (
            <MistakeCard key={`${mistake.original}→${mistake.improved}`} mistake={mistake} />
          ))}
          {summary.recurring_mistakes.length === 0 ? (
            <p className="wrapup-empty">
              {checking ||
                'Nothing repeated in this session. Mistakes that come up twice or more show up here.'}
            </p>
          ) : (
            <>
              {checking && <p className="wrapup-note">{checking}</p>}
              <p className="wrapup-note">
                These are already in Memory and will come back to review.
              </p>
            </>
          )}
          {phrases.length > 0 && (
            <Button
              className="wrapup-save"
              isDisabled={saveState === 'saving' || isSaved}
              onPress={() => void handleSaveAll()}
              variant="primary"
            >
              {isSaved ? (
                <Check aria-hidden="true" size={16} strokeWidth={2.2} />
              ) : (
                <Bookmark aria-hidden="true" size={16} strokeWidth={2} />
              )}
              {isSaved ? 'Saved to Memory' : savePhrasesLabel(toSave.length)}
            </Button>
          )}
          {saveState === 'error' && (
            <p className="wrapup-error" role="alert">
              Could not save these phrases. Please try again.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
