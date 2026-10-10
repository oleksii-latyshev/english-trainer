import { Button, Kbd } from '@heroui/react';
import { useState } from 'react';
import type { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import { type RescueState, useRescue } from './useRescue';

type Props = {
  capture: Pick<ReturnType<typeof useSpeechCapture>, 'rescueTranscript' | 'holdForRescue'>;
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
        isDisabled={isLoading}
        onPress={() => onChoose('next_step')}
        size="sm"
        variant={kind === 'next_step' ? 'secondary' : 'ghost'}
      >
        Next step
      </Button>
      <Button
        isDisabled={isLoading}
        onPress={() => onChoose('simpler')}
        size="sm"
        variant={kind === 'simpler' ? 'secondary' : 'ghost'}
      >
        Say it simpler
      </Button>
      <Button
        isDisabled={isLoading}
        onPress={onMissingWord}
        size="sm"
        variant={kind === 'missing_word' ? 'secondary' : 'ghost'}
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
      <Button onPress={rescue.open} size="sm" variant="secondary" aria-keyshortcuts="S">
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
        <Button onPress={rescue.close} size="sm" variant="ghost">
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
          <Button isDisabled={!description.trim()} size="sm" type="submit" variant="secondary">
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
              onPress={() => rescue.selectTerm(candidate)}
              size="sm"
              variant="ghost"
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
          <Button onPress={rescue.retry} size="sm" variant="secondary">
            Retry
          </Button>
        </div>
      )}
    </section>
  );
}
