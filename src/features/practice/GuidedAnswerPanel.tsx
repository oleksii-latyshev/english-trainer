import { Button } from '@heroui/react';
import { invoke, isTauri } from '@tauri-apps/api/core';
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
    <div className="grid gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
      <p className="m-0 text-xs text-zinc-400">
        Fictional example for this question. Replace details to make it true for you. Guided
        practice is kept separate from independent phrase mastery.
      </p>
      {step !== 'independent' && (
        <p className="m-0">
          <strong>Partner:</strong> {question}
        </p>
      )}
      {step === 'read' && (
        <>
          <p className="m-0 text-sm text-zinc-100">
            <strong>Example answer:</strong> {answer.model_answer}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={disabled}
              onPress={() => speech.play(answer.model_answer)}
            >
              Listen to example
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={disabled}
              onPress={() => {
                speech.stop();
                setStep('adapt');
              }}
            >
              Replace a few details
            </Button>
          </div>
          <p className="m-0">Read it aloud once, then make it your own.</p>
        </>
      )}
      {step === 'adapt' && (
        <>
          <label className="grid gap-1 font-medium">
            Your version — replace the words in brackets
            <textarea
              className="composer-textarea"
              aria-label="Adapt the example answer"
              rows={3}
              disabled={disabled}
              value={personalAnswer}
              onChange={(event) => {
                const value = event.target.value;
                setPersonalAnswer(value);
              }}
            />
          </label>
          <p className="m-0">
            Say your version using Record below. You can also try one short sentence of your own.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={disabled}
              onPress={() => setStep('read')}
            >
              Back to example
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={disabled}
              onPress={() => {
                speech.stop();
                setStep('independent');
              }}
            >
              Hide help and try speaking
            </Button>
          </div>
        </>
      )}
      {step === 'independent' && (
        <>
          <p className="m-0">
            Now answer in your own words using Record below. One or two simple sentences are enough.
          </p>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={disabled}
            onPress={() => setStep('adapt')}
          >
            Show my version again
          </Button>
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
    <div className="grid gap-2">
      <p className="m-0">
        Need a complete answer? Read an example, replace a few details, then speak.
      </p>
      <p className="m-0 text-zinc-400">
        Examples use Antigravity, including when conversation uses Apple. Only this question is
        sent.
      </p>
      <Button
        size="sm"
        variant="secondary"
        isDisabled={disabled || !isTauri() || !sessionId || !sequence || state.tag === 'loading'}
        onPress={() => void requestExample()}
      >
        {state.tag === 'loading' ? 'Preparing an example…' : 'Show complete example'}
      </Button>
      {state.tag === 'error' && (
        <p className="m-0 text-rose-300" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
