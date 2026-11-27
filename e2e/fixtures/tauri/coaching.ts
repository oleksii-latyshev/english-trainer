import type { Page } from '@playwright/test';
import type { FinishedPracticeSession } from '@/core/ipc';
import type { PracticeDialogue } from '@/core/ipc/bindings/PracticeDialogue';

export const SPOKEN_SECOND_TRY = 'I work there as an engineer.';

declare global {
  interface Window {
    __ET_COACHING__: {
      emit(event: string, payload: unknown): void;
      land(dialogue: PracticeDialogue, finished: FinishedPracticeSession | null): void;
    };
  }
}

async function installCoaching(page: Page, spokenText: string): Promise<void> {
  await page.addInitScript((spoken: string) => {
    const harness = window.__ET_HARNESS__;
    const listeners = new Map<number, (payload: unknown) => void>();
    const internals = window.__TAURI_INTERNALS__;
    const originalTransform = internals.transformCallback;
    const originalInvoke = internals.invoke;
    internals.transformCallback = (callback, once) => {
      const id = originalTransform(callback, once);
      listeners.set(id, callback);
      return id;
    };
    window.__ET_COACHING__ = {
      emit: (event, payload) => {
        for (const callback of listeners.values()) callback({ event, id: 1, payload });
      },
      land: (dialogue, finished) => {
        harness.dialogue = dialogue;
        if (finished) harness.finished = finished;
        window.__ET_COACHING__.emit('coaching-updated', { session_id: dialogue.session_id });
      },
    };

    function compare(args: Record<string, unknown>) {
      const sequence = Number(args.sequence);
      const dialogue = harness.dialogue;
      const turn = dialogue?.turns[sequence - 1];
      const coaching = dialogue?.coaching?.[sequence - 1];
      if (!dialogue || !turn || coaching?.state !== 'ready') {
        throw { code: 'invalid_request', message: 'This answer has no review to compare with.' };
      }
      const feedback = coaching.feedback;
      const retry = String(args.transcript);
      const normalise = (text: string) =>
        ` ${text
          .toLowerCase()
          .split(/[^a-z0-9']+/)
          .filter(Boolean)
          .join(' ')} `;
      const said = (phrase: string) => normalise(retry).includes(normalise(phrase));
      const check = (phrases: string[]) =>
        [...new Set(phrases)].map((phrase) => ({ phrase, said: said(phrase) }));
      return {
        turn_sequence: sequence,
        original_transcript: turn.learner,
        retry_transcript: retry,
        target: feedback.b2_rewrite,
        words_to_take: check(feedback.words_to_take.map((word) => word.phrase)),
        corrections: check([
          ...feedback.focus_feedback.map((focus) => focus.improved),
          ...feedback.upgrades.map((upgrade) => upgrade.improved),
          ...feedback.gaps.map((gap) => gap.word),
        ]),
      };
    }

    function retryCoaching(args: Record<string, unknown>): null {
      const sequence = Number(args.sequence);
      const dialogue = harness.dialogue;
      if (dialogue?.coaching) {
        const coaching = dialogue.coaching.map((state, index) =>
          index === sequence - 1 ? ({ state: 'pending' } as const) : state,
        );
        harness.dialogue = { ...dialogue, coaching };
      }
      return null;
    }

    internals.invoke = async (command, args = {}) => {
      if (command === 'transcribe_audio') {
        harness.calls.push({ command, args });
        return { text: spoken, language: 'en', duration_ms: 2000 };
      }
      if (command === 'retry_practice_turn') {
        harness.calls.push({ command, args });
        return compare(args);
      }
      if (command === 'retry_answer_coaching') {
        harness.calls.push({ command, args });
        return retryCoaching(args);
      }
      return originalInvoke(command, args);
    };
  }, spokenText);
}

export class CoachingBackend {
  enabled = false;
  private spoken = SPOKEN_SECOND_TRY;

  constructor(private readonly page: Page) {}

  available(): this {
    this.enabled = true;
    return this;
  }

  speaking(text: string): this {
    this.spoken = text;
    return this;
  }

  async install(): Promise<void> {
    if (this.enabled) await installCoaching(this.page, this.spoken);
  }

  async land(
    dialogue: PracticeDialogue,
    finished: Partial<FinishedPracticeSession> = {},
  ): Promise<void> {
    await this.page.evaluate(
      ({ nextDialogue, patch }) => {
        const current = window.__ET_HARNESS__.finished;
        window.__ET_COACHING__.land(nextDialogue, current ? { ...current, ...patch } : null);
      },
      { nextDialogue: dialogue, patch: finished },
    );
  }
}
