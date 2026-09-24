import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { isQuestionScaffold, type QuestionScaffold } from '@/lib/types';

type Mode = 'full' | 'partial' | 'off';
const MODES: Mode[] = ['full', 'partial', 'off'];
type HintState =
  | { tag: 'loading' }
  | { tag: 'ready'; question: string; hints: QuestionScaffold }
  | { tag: 'error'; question: string };

type Props = { question: string };

export function ScaffoldingPanel({ question }: Props) {
  const [mode, setMode] = useState<Mode>('partial');
  const [revealedQuestion, setRevealedQuestion] = useState<string | null>(null);
  const [hintState, setHintState] = useState<HintState>({ tag: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount intentionally reissues help for the same question.
  useEffect(() => {
    if (!isTauri()) return;
    let isCurrent = true;
    void invoke<unknown>('get_question_scaffold', { question })
      .then((result) => {
        if (!isCurrent) return;
        setHintState(
          isQuestionScaffold(result)
            ? { tag: 'ready', question, hints: result }
            : { tag: 'error', question },
        );
      })
      .catch(() => {
        if (isCurrent) setHintState({ tag: 'error', question });
      });
    return () => {
      isCurrent = false;
    };
  }, [question, retryCount]);

  const hints =
    hintState.tag === 'ready' && hintState.question === question ? hintState.hints : null;
  const hasError = hintState.tag === 'error' && hintState.question === question;
  const showExpressions = revealedQuestion === question;

  return (
    <section
      aria-label="Answer help"
      className="mb-5 rounded-xl border border-slate-600/50 bg-slate-900/30 p-4"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-100">Answer help</legend>
        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          {MODES.map((option) => (
            <label className="flex cursor-pointer items-center gap-2" key={option}>
              <input
                checked={mode === option}
                name="answer-help"
                onChange={() => setMode(option)}
                type="radio"
                value={option}
              />
              {option === 'full' ? 'Full' : option === 'partial' ? 'Partial' : 'Off'}
            </label>
          ))}
        </div>
      </fieldset>
      {mode !== 'off' && !isTauri() && (
        <p className="mb-0 text-sm text-slate-400">Answer help is available in the desktop app.</p>
      )}
      {mode !== 'off' && isTauri() && !hints && !hasError && (
        <p className="mb-0 text-sm text-slate-400">Preparing help for this question…</p>
      )}
      {mode !== 'off' && hasError && (
        <div className="mt-3 text-sm text-rose-200" role="alert">
          <p className="m-0">Answer help is unavailable. You can still keep speaking.</p>
          <button
            className="mt-2 text-teal-200 underline underline-offset-4"
            onClick={() => {
              setHintState({ tag: 'loading' });
              setRetryCount((current) => current + 1);
            }}
            type="button"
          >
            Retry help
          </button>
        </div>
      )}
      {mode !== 'off' && hints && (
        <div className="mt-4 grid gap-4 text-sm text-slate-200">
          <div>
            <p className="mb-1 font-semibold text-slate-100">A simple structure</p>
            <p className="m-0">{hints.structure.join(' → ')}</p>
          </div>
          {mode === 'full' && (
            <div>
              <p className="mb-1 font-semibold text-slate-100">Sentence starters</p>
              <ul className="m-0 list-disc pl-5">
                {hints.sentence_starters.map((starter) => (
                  <li key={starter}>{starter}</li>
                ))}
              </ul>
            </div>
          )}
          {(mode === 'full' || showExpressions) && (
            <div>
              <p className="mb-1 font-semibold text-slate-100">Useful expressions</p>
              <p className="m-0">{hints.useful_expressions.join(' · ')}</p>
            </div>
          )}
          {mode === 'partial' && (
            <button
              className="w-fit text-left text-teal-200 underline underline-offset-4"
              onClick={() =>
                setRevealedQuestion((current) => (current === question ? null : question))
              }
              type="button"
            >
              {showExpressions ? 'Hide expressions' : 'Show expressions'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
