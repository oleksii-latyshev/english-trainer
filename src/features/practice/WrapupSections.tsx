import { Button } from '@heroui/react';
import { Bookmark, Check, X } from 'lucide-react';
import type {
  FinishedPracticeSession,
  RecurringMistake,
  Trend,
  WrapupPhrase,
} from '@/lib/finishedPracticeSession';
import { formatDuration, savePhrasesLabel, trendLine } from './lib/wrapup';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type PhraseSelection = { removed: ReadonlySet<string>; saved: ReadonlySet<string> };

function StatCard(props: { label: string; value: string; trend: Trend; emptyHint: string }) {
  const line =
    props.value !== '—'
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

export function Stats({ numbers }: { numbers: FinishedPracticeSession['numbers'] }) {
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
        <div className="wrapup-phrase-note">{props.phrase.note}</div>
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

function PreparationState(props: {
  preparation: FinishedPracticeSession['wrapup_preparation'];
  hasGeneratedPhrases: boolean;
  isRetrying: boolean;
  retryMessage: string | undefined;
  onRetry: () => void;
}) {
  if (props.preparation?.state === 'failed') {
    return (
      <div className="wrapup-preparation-error">
        <p className="wrapup-error" role="alert">
          {props.retryMessage ?? props.preparation.error.message}
        </p>
        <Button isDisabled={props.isRetrying} onPress={props.onRetry} variant="secondary">
          Retry phrases
        </Button>
      </div>
    );
  }
  if (props.preparation?.state === 'legacy' || props.preparation === undefined) {
    return (
      <>
        {props.retryMessage && (
          <p className="wrapup-error" role="alert">
            {props.retryMessage}
          </p>
        )}
        <Button isDisabled={props.isRetrying} onPress={props.onRetry} variant="secondary">
          Prepare phrases
        </Button>
      </>
    );
  }
  if (props.retryMessage) {
    return (
      <p className="wrapup-error" role="alert">
        {props.retryMessage}
      </p>
    );
  }
  if (props.hasGeneratedPhrases) return null;

  let message = 'Phrases appear here when Eva coaches an answer.';
  if (props.preparation?.state === 'pending') message = 'Preparing phrases from your answers…';
  if (props.preparation?.state === 'ready') message = 'No phrases to keep from this session.';
  return <p className="wrapup-empty">{message}</p>;
}

export function PhraseSection(props: {
  summary: FinishedPracticeSession;
  phrases: WrapupPhrase[];
  selection: PhraseSelection;
  retrying: boolean;
  retryMessage: string | undefined;
  checking: string;
  onRemove: (phrase: string) => void;
  onRetry: () => void;
}) {
  const { summary, phrases, selection } = props;
  return (
    <section aria-labelledby="wrapup-phrases" className="wrapup-section">
      <SectionHeading count={phrases.length} id="wrapup-phrases" title="Phrases worth learning" />
      {phrases.map((item) => (
        <PhraseCard
          canRemove={!selection.saved.has(item.phrase)}
          key={item.phrase}
          onRemove={() => props.onRemove(item.phrase)}
          phrase={item}
        />
      ))}
      <PreparationState
        hasGeneratedPhrases={summary.phrases.length > 0}
        isRetrying={props.retrying}
        onRetry={props.onRetry}
        preparation={summary.wrapup_preparation}
        retryMessage={props.retryMessage}
      />
      {props.checking && <p className="wrapup-note">{props.checking}</p>}
    </section>
  );
}

function PhraseSaveButton(props: {
  count: number;
  isSaved: boolean;
  saveState: SaveState;
  onSave: () => void;
}) {
  if (props.count === 0 && !props.isSaved) return null;
  return (
    <>
      <Button
        className="wrapup-save"
        isDisabled={props.saveState === 'saving' || props.isSaved}
        onPress={props.onSave}
        variant="primary"
      >
        {props.isSaved ? (
          <Check aria-hidden="true" size={16} strokeWidth={2.2} />
        ) : (
          <Bookmark aria-hidden="true" size={16} strokeWidth={2} />
        )}
        {props.isSaved ? 'Saved to Memory' : savePhrasesLabel(props.count)}
      </Button>
      {props.saveState === 'error' && (
        <p className="wrapup-error" role="alert">
          Could not save these phrases. Please try again.
        </p>
      )}
    </>
  );
}

export function MistakesSection(props: {
  summary: FinishedPracticeSession;
  checking: string;
  toSaveCount: number;
  isSaved: boolean;
  saveState: SaveState;
  onSave: () => void;
}) {
  const { summary } = props;
  return (
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
          {props.checking ||
            'Nothing repeated in this session. Mistakes that come up twice or more show up here.'}
        </p>
      ) : (
        <>
          {props.checking && <p className="wrapup-note">{props.checking}</p>}
          <p className="wrapup-note">These are already in Memory and will come back to review.</p>
        </>
      )}
      {summary.wrapup_preparation?.state !== 'pending' &&
        summary.wrapup_preparation?.state !== 'failed' && (
          <PhraseSaveButton
            count={props.toSaveCount}
            isSaved={props.isSaved}
            onSave={props.onSave}
            saveState={props.saveState}
          />
        )}
    </section>
  );
}
