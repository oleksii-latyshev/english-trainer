import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Kbd } from '@/shared/ui/kbd';
import { type RescueCapture, type RescueState, useRescue } from './useRescue';

type Props = {
  capture: RescueCapture;
  recordingId: number;
  sessionId: number;
  phase: string;
  sequence: number;
  question: string;
};

function RescueModes({
  kind,
  isLoading,
  onChoose,
  onMissingWord,
}: {
  kind: 'next_step' | 'simpler' | 'missing_word';
  isLoading: boolean;
  onChoose: (kind: 'next_step' | 'simpler') => void;
  onMissingWord: () => void;
}) {
  return (
    <fieldset className="talk-rescue-modes">
      <legend className="talk-rescue-legend">Rescue type</legend>
      <Button
        disabled={isLoading}
        onClick={() => onChoose('next_step')}
        size="sm"
        tone={kind === 'next_step' ? 'secondary' : 'quiet'}
      >
        Next step
      </Button>
      <Button
        disabled={isLoading}
        onClick={() => onChoose('simpler')}
        size="sm"
        tone={kind === 'simpler' ? 'secondary' : 'quiet'}
      >
        Say it simpler
      </Button>
      <Button
        disabled={isLoading}
        onClick={onMissingWord}
        size="sm"
        tone={kind === 'missing_word' ? 'secondary' : 'quiet'}
      >
        Missing word
      </Button>
    </fieldset>
  );
}

function visibleKind(state: RescueState): 'next_step' | 'simpler' | 'missing_word' {
  if (state.tag === 'loading' || state.tag === 'answer' || state.tag === 'error') {
    return state.kind;
  }
  if (state.tag === 'missing-word' || state.tag === 'selected') return 'missing_word';
  return 'next_step';
}

export function RescuePanel(props: Props) {
  const rescue = useRescue({ ...props, isRecording: true });
  const [description, setDescription] = useState('');
  const { state } = rescue;

  if (state.tag === 'closed') {
    return (
      <Button onClick={rescue.open} size="sm" tone="secondary" aria-keyshortcuts="S">
        Stuck <Kbd>S</Kbd>
      </Button>
    );
  }

  const isLoading = state.tag === 'loading';
  const kind = visibleKind(state);
  const candidates =
    state.tag === 'answer' && state.response.kind === 'missing_word'
      ? state.response.candidates
      : [];
  const shownError = state.tag === 'error' ? state.message : '';

  return (
    <section className="talk-rescue" aria-label="Stuck rescue">
      <div className="talk-rescue-head">
        <strong>Need a little help?</strong>
        <Button onClick={rescue.close} size="sm" tone="quiet">
          Continue speaking
        </Button>
      </div>
      <RescueModes
        isLoading={isLoading}
        kind={kind}
        onChoose={rescue.chooseKind}
        onMissingWord={() => {
          setDescription('');
          rescue.chooseKind('missing_word');
        }}
      />
      {state.tag === 'missing-word' && (
        <form
          className="talk-rescue-form"
          onSubmit={(event) => {
            event.preventDefault();
            rescue.findWord(description);
          }}
        >
          <label htmlFor="talk-rescue-description">Describe the word in English</label>
          <input
            autoComplete="off"
            id="talk-rescue-description"
            maxLength={300}
            onChange={(event) => {
              const next = event.target.value;
              setDescription(next);
            }}
            value={description}
          />
          <Button disabled={!description.trim()} size="sm" type="submit" tone="secondary">
            Find a word
          </Button>
        </form>
      )}
      {state.tag === 'loading' && <p role="status">Finding a short suggestion…</p>}
      {state.tag === 'answer' && state.kind !== 'missing_word' && (
        <p className="talk-rescue-answer" role="status">
          {state.response.kind !== 'missing_word' && state.response.suggestion}
        </p>
      )}
      {state.tag === 'answer' && state.kind === 'missing_word' && (
        <fieldset className="talk-rescue-candidates">
          <legend className="talk-rescue-legend">Word suggestions</legend>
          {candidates.map((candidate) => (
            <Button
              key={candidate}
              onClick={() => rescue.selectTerm(candidate)}
              size="sm"
              tone="quiet"
            >
              {candidate}
            </Button>
          ))}
        </fieldset>
      )}
      {state.tag === 'selected' && (
        <p className="talk-rescue-answer" role="status">
          {state.term}
        </p>
      )}
      {state.tag === 'error' && (
        <div className="talk-rescue-error" role="alert">
          <span>{shownError}</span>
          <Button onClick={rescue.retry} size="sm" tone="secondary">
            Retry
          </Button>
        </div>
      )}
    </section>
  );
}
