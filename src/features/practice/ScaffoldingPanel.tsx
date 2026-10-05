import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { isQuestionScaffold, type QuestionScaffold } from '@/lib/types';
import { GuidedAnswerPanel } from './GuidedAnswerPanel';

type Mode = 'full' | 'partial' | 'off';
const MODES: Mode[] = ['full', 'partial', 'off'];
type HintState =
  | { tag: 'loading' }
  | { tag: 'ready'; question: string; hints: QuestionScaffold }
  | { tag: 'error'; question: string };

type Props = { question: string; sessionId?: number; sequence?: number; disabled?: boolean };

export function ScaffoldingPanel({ question, sessionId, sequence, disabled = false }: Props) {
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
    <section aria-label="Answer help" className="scaffold-card">
      <div className="scaffold-toggle-row">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Answer help
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-black/30 p-1 text-xs">
          {MODES.map((option) => (
            <button
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                mode === option
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              key={option}
              onClick={() => setMode(option)}
              type="button"
            >
              {option === 'full' ? 'Full Help' : option === 'partial' ? 'Key Points' : 'Off'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'full' && (
        <GuidedAnswerPanel
          question={question}
          sessionId={sessionId}
          sequence={sequence}
          disabled={disabled}
        />
      )}
      {mode !== 'off' && !isTauri() && (
        <p className="m-0 text-xs text-zinc-400">Answer help is available in the desktop app.</p>
      )}
      {mode !== 'off' && isTauri() && !hints && !hasError && (
        <p className="m-0 text-xs text-zinc-400">Preparing help for this question…</p>
      )}
      {mode !== 'off' && hasError && (
        <div className="text-xs text-rose-300" role="alert">
          <p className="m-0">Answer help is unavailable. You can still keep speaking.</p>
          <button
            className="mt-1 text-purple-300 underline underline-offset-4"
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
        <div className="grid gap-3 pt-1 text-xs text-zinc-300">
          <div>
            <p className="mb-1.5 font-semibold text-zinc-200">Recommended flow:</p>
            <div className="flex flex-wrap items-center gap-2">
              {hints.structure.map((step, idx) => (
                <span className="flex items-center gap-1.5" key={step}>
                  <span className="scaffold-pill font-medium">{step}</span>
                  {idx < hints.structure.length - 1 && <span className="text-zinc-500">→</span>}
                </span>
              ))}
            </div>
          </div>
          {mode === 'full' && (
            <div>
              <p className="mb-1.5 font-semibold text-zinc-200">Sentence starters:</p>
              <div className="scaffold-pills">
                {hints.sentence_starters.map((starter) => (
                  <span className="scaffold-pill" key={starter}>
                    {starter}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(mode === 'full' || showExpressions) && (
            <div>
              <p className="mb-1.5 font-semibold text-zinc-200">Useful expressions:</p>
              <div className="scaffold-pills">
                {hints.useful_expressions.map((expr) => (
                  <span className="scaffold-pill !border-purple-500/20 !text-purple-300" key={expr}>
                    {expr}
                  </span>
                ))}
              </div>
            </div>
          )}
          {mode === 'partial' && (
            <button
              className="w-fit text-left text-xs text-purple-300 hover:text-purple-200 underline underline-offset-4"
              onClick={() =>
                setRevealedQuestion((current) => (current === question ? null : question))
              }
              type="button"
            >
              {showExpressions ? 'Hide expressions' : 'Show useful expressions'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
