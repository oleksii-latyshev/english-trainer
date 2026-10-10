import type { Page } from '@playwright/test';
import type { FinishedPracticeSession } from '../src/lib/finishedPracticeSession';
import type { PhraseCardRecord } from '../src/lib/learningTypes';

export type WrapupFixtureOptions = {
  finished: FinishedPracticeSession;
  afterRetry?: FinishedPracticeSession;
  retryError?: { code: 'unavailable' | 'rate_limited' | 'timeout'; message: string };
  existingCards?: PhraseCardRecord[];
};

declare global {
  interface Window {
    __ET_WRAPUP__: {
      afterRetry: FinishedPracticeSession | null;
      retryError: WrapupFixtureOptions['retryError'] | null;
      existingCards: PhraseCardRecord[];
      cards: PhraseCardRecord[];
      deletedIds: number[];
      nextId: number;
      emit(event: string, payload: unknown): void;
      completePreparation(summary: FinishedPracticeSession): void;
    };
  }
}

/** Configures typed IPC/provider edges for finished-session wrap-up flows. */
export async function installWrapupFixture(
  page: Page,
  options: WrapupFixtureOptions,
): Promise<void> {
  await page.addInitScript((config: WrapupFixtureOptions) => {
    const harness = window.__ET_HARNESS__;
    harness.finishedTemplate = config.finished;
    const listeners = new Map<number, (payload: unknown) => void>();
    const originalTransform = window.__TAURI_INTERNALS__.transformCallback;
    const originalInvoke = window.__TAURI_INTERNALS__.invoke;
    let callbackId = 1;
    window.__TAURI_INTERNALS__.transformCallback = (callback, once) => {
      const id = originalTransform(callback, once);
      listeners.set(callbackId++, callback);
      return id;
    };
    window.__ET_WRAPUP__ = {
      afterRetry: config.afterRetry ?? null,
      retryError: config.retryError ?? null,
      existingCards: config.existingCards ?? [],
      cards: [],
      deletedIds: [],
      nextId: 500,
      emit: (event, payload) => {
        for (const callback of listeners.values()) callback({ event, id: 1, payload });
      },
      completePreparation: (summary) => {
        harness.finished = summary;
        window.__ET_WRAPUP__.emit('wrapup-updated', { session_id: summary.session_id });
      },
    };
    function deletePhrase(args: Record<string, unknown> | undefined): boolean {
      const phraseId = args?.phrase_id;
      if (typeof phraseId !== 'number') throw new Error('Harness expected numeric phrase_id.');
      window.__ET_WRAPUP__.deletedIds.push(phraseId);
      window.__ET_WRAPUP__.cards = window.__ET_WRAPUP__.cards.filter(
        (card) => card.id !== phraseId,
      );
      return true;
    }

    function retryPhrases(args: Record<string, unknown> | undefined): undefined {
      harness.calls.push({ command: 'retry_session_wrapup', args: args ?? {} });
      const sessionId = args?.sessionId;
      const current = harness.finished;
      if (typeof sessionId !== 'number' || !current || current.session_id !== sessionId) {
        throw { code: 'invalid_session', message: 'Finish the session before preparing phrases.' };
      }
      const fixture = window.__ET_WRAPUP__;
      if (fixture.retryError) throw fixture.retryError;
      harness.finished = { ...current, wrapup_preparation: { state: 'pending' } };
      fixture.emit('wrapup-updated', { session_id: sessionId });
      const afterRetry = fixture.afterRetry;
      if (afterRetry) window.setTimeout(() => fixture.completePreparation(afterRetry), 10);
      return undefined;
    }

    function isStringList(value: unknown): value is string[] {
      return Array.isArray(value) && value.every((phrase) => typeof phrase === 'string');
    }

    function savePhrases(args: Record<string, unknown> | undefined) {
      harness.calls.push({ command: 'save_wrapup_phrases', args: args ?? {} });
      const sessionId = args?.sessionId;
      const phrases = args?.phrases;
      const current = harness.finished;
      const isReady = current?.wrapup_preparation?.state === 'ready';
      const isLegacy = current?.wrapup_preparation?.state === 'legacy';
      const isValid =
        typeof sessionId === 'number' &&
        current?.session_id === sessionId &&
        (isReady || isLegacy) &&
        isStringList(phrases) &&
        phrases.length >= 1 &&
        phrases.length <= 3 &&
        phrases.every((phrase) => phrase.trim().length > 0) &&
        new Set(phrases).size === phrases.length;
      if (!isValid || !current || typeof sessionId !== 'number' || !isStringList(phrases)) {
        throw { code: 'invalid_request', message: 'Choose one to three ready phrases to save.' };
      }
      return savePhraseRecords(current, sessionId, phrases);
    }

    function savePhraseRecords(
      current: FinishedPracticeSession,
      sessionId: number,
      phrases: string[],
    ) {
      const fixture = window.__ET_WRAPUP__;
      const cards: PhraseCardRecord[] = [];
      const created_ids: number[] = [];
      for (const phrase of phrases) {
        const source = current.phrases.find((item) => item.phrase === phrase);
        if (!source)
          throw { code: 'invalid_request', message: 'Choose a phrase from this session.' };
        const existing = [...fixture.existingCards, ...fixture.cards].find(
          (card) => card.phrase.toLocaleLowerCase() === phrase.toLocaleLowerCase(),
        );
        if (existing) {
          cards.push(existing);
          continue;
        }
        const id = fixture.nextId++;
        const now = Date.now();
        const card: PhraseCardRecord = {
          id,
          phrase,
          normalized_phrase: phrase.trim().toLocaleLowerCase(),
          meaning_or_note: source.note,
          session_id: sessionId,
          sequence: source.sequence,
          created_at: now,
          last_reviewed_at: null,
          next_review_at: now,
          interval_days: 1,
          ease_factor: 2.5,
          status: 'new',
          is_due: true,
        };
        fixture.cards.push(card);
        cards.push(card);
        created_ids.push(id);
      }
      return { cards, created_ids };
    }

    window.__TAURI_INTERNALS__.invoke = async (command, args) => {
      if (command === 'delete_phrase_card') return deletePhrase(args);
      if (command === 'retry_session_wrapup') return retryPhrases(args);
      if (command === 'save_wrapup_phrases') return savePhrases(args);
      return originalInvoke(command, args);
    };
  }, options);
}
