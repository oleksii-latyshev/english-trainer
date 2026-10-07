import { Button, Kbd } from '@heroui/react';
import { isTauri } from '@tauri-apps/api/core';
import { Fragment } from 'react';
import { GuidedAnswerPanel } from './GuidedAnswerPanel';
import { HELP_LEVELS, type HelpLevel } from './lib/helpLevels';
import { useQuestionScaffold } from './useQuestionScaffold';

type Props = {
  question: string;
  sessionId?: number;
  sequence?: number;
  /** The open level, or null while help is closed. */
  level: HelpLevel | null;
  onLevelChange: (level: HelpLevel | null) => void;
  disabled: boolean;
};

function Chips({ items }: { items: string[] }) {
  return (
    <div className="talk-help-chips">
      {items.map((item) => (
        <span className="talk-chip-static" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function PhrasesPanel({ scaffold }: { scaffold: ReturnType<typeof useQuestionScaffold> }) {
  const { hints, hasError, retry } = scaffold;
  if (!isTauri())
    return <p className="talk-help-text">Answer help is available in the desktop app.</p>;
  if (hasError) {
    return (
      <div className="talk-help-group" role="alert">
        <p className="talk-help-text">Answer help is unavailable. You can still keep speaking.</p>
        <div className="talk-help-actions">
          <Button onPress={retry} size="sm" variant="secondary">
            Retry help
          </Button>
        </div>
      </div>
    );
  }
  if (!hints) return <p className="talk-help-text">Preparing help for this question…</p>;
  return (
    <>
      <div className="talk-help-group">
        <div className="talk-help-caption">A simple flow for this question</div>
        <div className="talk-help-chips">
          {hints.structure.map((step, index) => (
            <Fragment key={step}>
              <span className="talk-chip-static">{step}</span>
              {index < hints.structure.length - 1 && (
                <span aria-hidden="true" className="talk-help-arrow">
                  →
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="talk-help-group">
        <div className="talk-help-caption">Phrases that fit this question</div>
        <Chips items={[...hints.sentence_starters, ...hints.useful_expressions]} />
      </div>
    </>
  );
}

export function HelpBar({ question, sessionId, sequence, level, onLevelChange, disabled }: Props) {
  // Always mounted, so the phrases are ready by the time the learner opens them.
  const scaffold = useQuestionScaffold(question);
  return (
    <section aria-label="Answer help" className="talk-help">
      <div className="talk-help-row">
        <span className="talk-help-label">Need help?</span>
        {HELP_LEVELS.map((item) => (
          <Button
            aria-pressed={level === item.id}
            className="talk-chip"
            key={item.id}
            onPress={() => onLevelChange(level === item.id ? null : item.id)}
            size="sm"
            variant="outline"
          >
            <span aria-hidden="true" className="talk-chip-number">
              {item.keyNumber}
            </span>
            {item.label}
          </Button>
        ))}
        <span className="talk-help-key">
          <Kbd>H</Kbd>
          help
        </span>
      </div>
      {level === 'phrases' && (
        <div className="talk-help-panel">
          <PhrasesPanel scaffold={scaffold} />
        </div>
      )}
      {level === 'example' && (
        <div className="talk-help-panel">
          <GuidedAnswerPanel
            disabled={disabled}
            question={question}
            sequence={sequence}
            sessionId={sessionId}
          />
        </div>
      )}
    </section>
  );
}
