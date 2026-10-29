import type { Page } from '@playwright/test';
import { fourStepRun, type RunItemSeed, SPOKEN_CORRECT } from '../../data/mistake-run';

export type CheckVerdict = 'pass' | 'miss';

type RunSeed = {
  items: RunItemSeed[];
  spoken: string;
  answered: number;
};

declare global {
  interface Window {
    __ET_MISTAKE_RUN__: {
      resolve(position: number, verdict: CheckVerdict): void;
      fail(position: number): void;
    };
  }
}

export class MistakeRunBackend {
  private items: RunItemSeed[] = fourStepRun;
  private spoken = SPOKEN_CORRECT;
  private answered = 0;
  private enabled = false;

  constructor(private readonly page: Page) {}

  withExercises(items: RunItemSeed[]): this {
    this.enabled = true;
    this.items = items;
    return this;
  }

  withAnsweredExercises(count: number): this {
    this.enabled = true;
    this.answered = count;
    return this;
  }

  hearing(spoken: string): this {
    this.enabled = true;
    this.spoken = spoken;
    return this;
  }

  async resolveCheck(position: number, verdict: CheckVerdict): Promise<void> {
    await this.page.evaluate(({ at, outcome }) => window.__ET_MISTAKE_RUN__.resolve(at, outcome), {
      at: position,
      outcome: verdict,
    });
  }

  async failCheck(position: number): Promise<void> {
    await this.page.evaluate((at) => window.__ET_MISTAKE_RUN__.fail(at), position);
  }

  available(): this {
    this.enabled = true;
    return this;
  }

  async install(): Promise<void> {
    if (!this.enabled) return;
    const seed: RunSeed = { items: this.items, spoken: this.spoken, answered: this.answered };
    await this.page.addInitScript((state: RunSeed) => {
      type Attempt = {
        id: number;
        outcome: 'pass' | 'miss' | 'checking' | 'retry';
        by: 'local' | 'ai';
        note: string;
        failed: boolean;
      };
      const harness = window.__ET_HARNESS__;
      const internals = window.__TAURI_INTERNALS__;
      const originalInvoke = internals.invoke;
      const MISS = 'Not quite — here is the version to keep.';
      const attempts: Attempt[][] = state.items.map(() => []);
      let nextId = 100;
      let finished = false;

      function normal(text: string): string[] {
        return text
          .toLowerCase()
          .replace(/[^a-z0-9\s']/g, '')
          .split(/\s+/)
          .filter(Boolean);
      }
      function same(left: string, right: string): boolean {
        return normal(left).join(' ') === normal(right).join(' ');
      }
      function gapWords(index: number): string {
        const item = state.items[index];
        const words = item.corrected.split(/\s+/);
        return item.gaps.flatMap((gap) => words.slice(gap.start, gap.end)).join(' ');
      }
      function matches(index: number, answer: string): boolean {
        const item = state.items[index];
        if (item.step === 1) return same(item.corrected, answer) || same(gapWords(index), answer);
        if (item.step === 2) {
          return same(item.corrected, answer) || item.accepted.some((kept) => same(kept, answer));
        }
        return normal(answer).join(' ').includes(normal(item.corrected).join(' '));
      }
      function view(index: number) {
        const item = state.items[index];
        const own = attempts[index];
        const decisive = own.find((attempt) => attempt.outcome !== 'retry');
        const retry = [...own].reverse().find((attempt) => attempt.outcome === 'retry');
        const hidden = (at: number) => item.gaps.some((gap) => gap.start <= at && at < gap.end);
        return {
          position: index,
          mistake_id: item.mistake_id,
          step: item.step,
          rule_key: item.rule_key,
          question: item.question,
          said: item.step === 2 ? item.said : null,
          sentence:
            item.step === 1
              ? {
                  words: item.corrected.split(/\s+/).map((word, at) => (hidden(at) ? null : word)),
                  gaps: item.gaps,
                }
              : null,
          result: decisive
            ? {
                attempt_id: decisive.id,
                outcome: decisive.outcome,
                note: decisive.note,
                keep: item.corrected,
                lesson: item.lesson,
                can_check:
                  item.step === 2 &&
                  decisive.outcome === 'miss' &&
                  decisive.by === 'local' &&
                  !retry,
                retried: Boolean(retry),
                retry_note: retry ? retry.note : null,
                check_failed: decisive.outcome === 'checking' && decisive.failed,
              }
            : null,
        };
      }
      function runView() {
        return {
          run_id: 7,
          kind: 'due',
          finished,
          items: state.items.map((_, index) => view(index)),
        };
      }
      function attempt(outcome: Attempt['outcome'], by: Attempt['by'], note: string): Attempt {
        nextId += 1;
        return { id: nextId, outcome, by, note, failed: false };
      }
      function firstAttempt(index: number, text: string): Attempt {
        if (state.items[index].step === 4) return attempt('checking', 'ai', '');
        return matches(index, text)
          ? attempt('pass', 'local', 'Right.')
          : attempt('miss', 'local', MISS);
      }
      function retryNote(index: number, text: string): string {
        if (state.items[index].step === 4) return 'Noted. Practice does not change your schedule.';
        return matches(index, text)
          ? 'That matches the version to keep.'
          : 'Still not the version to keep.';
      }
      function answer(index: number, text: string): void {
        const own = attempts[index];
        const decisive = own.find((entry) => entry.outcome !== 'retry');
        if (!decisive) {
          own.push(firstAttempt(index, text));
          return;
        }
        const isOpen =
          decisive.outcome === 'miss' && !own.some((entry) => entry.outcome === 'retry');
        if (!isOpen) throw { code: 'invalid_request', message: 'This exercise takes no answer.' };
        own.push(attempt('retry', 'local', retryNote(index, text)));
      }
      function emit(): void {
        window.__ET_MISTAKES__.emit();
      }

      for (let index = 0; index < state.answered; index += 1) {
        attempts[index].push(attempt('pass', 'local', 'Right.'));
      }
      window.__ET_MISTAKE_RUN__ = {
        resolve: (position, verdict) => {
          const decisive = attempts[position].find((entry) => entry.outcome !== 'retry');
          if (decisive) {
            decisive.outcome = verdict;
            decisive.by = 'ai';
            decisive.failed = false;
            decisive.note = verdict === 'pass' ? 'Right.' : MISS;
          }
          emit();
        },
        fail: (position) => {
          const decisive = attempts[position].find((entry) => entry.outcome !== 'retry');
          if (decisive) decisive.failed = true;
          emit();
        },
      };

      function checkAnswer(position: number) {
        const own = attempts[position];
        const at = own.findIndex((entry) => entry.outcome === 'miss');
        if (at >= 0) own[at] = attempt('checking', 'ai', '');
        return view(position);
      }
      function retryCheck(attemptId: unknown): null {
        for (const entry of attempts.flat()) if (entry.id === attemptId) entry.failed = false;
        return null;
      }
      const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
        start_mistake_run: () => runView(),
        get_mistake_run: () => runView(),
        answer_mistake_step: (args) => {
          if (finished) throw { code: 'invalid_request', message: 'This practice is over.' };
          answer(Number(args.position), String(args.answer));
          return view(Number(args.position));
        },
        check_mistake_answer: (args) => checkAnswer(Number(args.position)),
        retry_mistake_check: (args) => retryCheck(args.attemptId),
        finish_mistake_run: () => {
          finished = true;
          return runView();
        },
        transcribe_audio: () => ({ text: state.spoken, language: 'en', duration_ms: 2000 }),
      };
      internals.invoke = async (command, args = {}) => {
        const handler = handlers[command];
        if (!handler) return originalInvoke(command, args);
        harness.calls.push({ command, args });
        return handler(args);
      };
    }, seed);
  }
}
