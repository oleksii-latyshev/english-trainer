import { Button } from '@heroui/react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTrainer } from '@/context/TrainerContext';
import { type GuidedAnswer, isGuidedAnswer } from '@/lib/guidedAnswerTypes';
import { isProviderError } from '@/lib/types';

function exampleError(cause: unknown): string {
  return isProviderError(cause)
    ? cause.message
    : 'The example could not be loaded. You can keep speaking or retry.';
}

type State =
  | { tag: 'idle' | 'loading' }
  | { tag: 'ready'; answer: GuidedAnswer }
  | { tag: 'error'; message: string };

function GuidedExample({
  answer,
  question,
  disabled,
}: {
  answer: GuidedAnswer;
  question: string;
  disabled: boolean;
}) {
  const { speech } = useTrainer();
  const [step, setStep] = useState<'read' | 'adapt' | 'independent'>('read');
  const [personalAnswer, setPersonalAnswer] = useState(answer.adaptation);
  return (
    <div className="talk-help-group">
      <div className="talk-help-caption">
        Fictional example for this question. Replace details to make it true for you. Guided
        practice is kept separate from independent phrase mastery.
      </div>
      {step !== 'independent' && (
        <p className="talk-help-text">
          <strong>Partner:</strong> {question}
        </p>
      )}
      {step === 'read' && (
        <>
          <p className="talk-help-example">{answer.model_answer}</p>
          <div className="talk-help-actions">
            <Button
              isDisabled={disabled}
              onPress={() => speech.play(answer.model_answer)}
              size="sm"
              variant="secondary"
            >
              <Play aria-hidden="true" fill="currentColor" size={12} />
              Listen to example
            </Button>
            <Button
              isDisabled={disabled}
              onPress={() => {
                speech.stop();
                setStep('adapt');
              }}
              size="sm"
              variant="secondary"
            >
              Replace a few details
            </Button>
          </div>
          <p className="talk-help-text">Read it aloud once, then make it your own.</p>
        </>
      )}
      {step === 'adapt' && (
        <>
          <label className="talk-help-field">
            Your version — replace the words in brackets
            <textarea
              aria-label="Adapt the example answer"
              className="talk-help-textarea"
              disabled={disabled}
              onChange={(event) => {
                const value = event.target.value;
                setPersonalAnswer(value);
              }}
              rows={3}
              value={personalAnswer}
            />
          </label>
          <p className="talk-help-text">
            Say your version with the microphone below. You can also try one short sentence of your
            own.
          </p>
          <div className="talk-help-actions">
            <Button
              isDisabled={disabled}
              onPress={() => setStep('read')}
              size="sm"
              variant="secondary"
            >
              Back to example
            </Button>
            <Button
              isDisabled={disabled}
              onPress={() => {
                speech.stop();
                setStep('independent');
              }}
              size="sm"
              variant="ghost"
            >
              Hide before speaking
            </Button>
          </div>
        </>
      )}
      {step === 'independent' && (
        <>
          <p className="talk-help-text">
            Now answer in your own words with the microphone below. One or two simple sentences are
            enough.
          </p>
          <div className="talk-help-actions">
            <Button
              isDisabled={disabled}
              onPress={() => setStep('adapt')}
              size="sm"
              variant="secondary"
            >
              Show my version again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function GuidedAnswerPanel({
  question,
  sessionId,
  sequence,
  disabled,
}: {
  question: string;
  sessionId?: number;
  sequence?: number;
  disabled: boolean;
}) {
  const [state, setState] = useState<State>({ tag: 'idle' });
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  async function requestExample() {
    if (!sessionId || !sequence || disabled || inFlight.current) return;
    inFlight.current = true;
    const request = ++generation.current;
    setState({ tag: 'loading' });
    try {
      const result: unknown = await invoke('get_guided_answer', { sessionId, sequence, question });
      if (generation.current !== request) return;
      if (!isGuidedAnswer(result)) throw new Error('Invalid answer example.');
      setState({ tag: 'ready', answer: result });
    } catch (cause) {
      if (generation.current === request)
        setState({
          tag: 'error',
          message: exampleError(cause),
        });
    } finally {
      inFlight.current = false;
    }
  }

  if (state.tag === 'ready')
    return <GuidedExample answer={state.answer} question={question} disabled={disabled} />;
  return (
    <div className="talk-help-group">
      <p className="talk-help-text">
        Need a complete answer? Read an example, replace a few details, then speak.
      </p>
      <div className="talk-help-caption">
        Examples use Antigravity, including when conversation uses Apple. Only this question is
        sent.
      </div>
      <div className="talk-help-actions">
        <Button
          isDisabled={disabled || !isTauri() || !sessionId || !sequence || state.tag === 'loading'}
          onPress={() => void requestExample()}
          size="sm"
          variant="secondary"
        >
          {state.tag === 'loading' ? 'Preparing an example…' : 'Show complete example'}
        </Button>
      </div>
      {state.tag === 'error' && (
        <p className="talk-help-text" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
