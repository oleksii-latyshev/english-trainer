import type { Page } from '@playwright/test';
import type { FinishedPracticeSession, PhraseCardRecord } from '@/core/ipc';

export type WrapupOptions = {
  finished: FinishedPracticeSession;
};

declare global {
  interface Window {
    __ET_WRAPUP__: {
      cards: PhraseCardRecord[];
      deletedIds: number[];
      nextId: number;
    };
  }
}

async function installWrapup(page: Page, options: WrapupOptions): Promise<void> {
  await page.addInitScript((config: WrapupOptions) => {
    const harness = window.__ET_HARNESS__;
    harness.finishedTemplate = config.finished;
    const originalInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__ET_WRAPUP__ = { cards: [], deletedIds: [], nextId: 500 };
    function deletePhrase(args: Record<string, unknown> | undefined): boolean {
      const phraseId = args?.phrase_id;
      if (typeof phraseId !== 'number') throw new Error('Harness expected numeric phrase_id.');
      window.__ET_WRAPUP__.deletedIds.push(phraseId);
      window.__ET_WRAPUP__.cards = window.__ET_WRAPUP__.cards.filter(
        (card) => card.id !== phraseId,
      );
      return true;
    }

    function saveWordCard(args: Record<string, unknown> | undefined): PhraseCardRecord {
      harness.calls.push({ command: 'save_phrase_card', args: args ?? {} });
      const phrase = args?.phrase;
      const sessionId = args?.session_id;
      const sequence = args?.sequence;
      if (typeof phrase !== 'string' || typeof sessionId !== 'number') {
        throw { code: 'invalid_request', message: 'Choose a phrase to save.' };
      }
      const fixture = window.__ET_WRAPUP__;
      const now = Date.now();
      const card: PhraseCardRecord = {
        id: fixture.nextId++,
        phrase,
        kind: 'phrase',
        normalized_phrase: phrase.trim().toLocaleLowerCase(),
        meaning_or_note: typeof args?.meaning_or_note === 'string' ? args.meaning_or_note : '',
        session_id: sessionId,
        sequence: typeof sequence === 'number' ? sequence : null,
        created_at: now,
        last_reviewed_at: null,
        next_review_at: now,
        interval_days: 1,
        ease_factor: 2.5,
        status: 'new',
        is_due: true,
        times_used_on_own: 0,
      };
      fixture.cards.push(card);
      return card;
    }

    window.__TAURI_INTERNALS__.invoke = async (command, args) => {
      if (command === 'save_phrase_card') return saveWordCard(args);
      if (command === 'delete_phrase_card') return deletePhrase(args);
      return originalInvoke(command, args);
    };
  }, options);
}

export class WrapupBackend {
  enabled = false;
  private options: Partial<WrapupOptions> = {};

  constructor(private readonly page: Page) {}

  finishingWith(finished: FinishedPracticeSession): this {
    this.enabled = true;
    this.options = { ...this.options, finished };
    return this;
  }

  async install(): Promise<void> {
    if (this.enabled && this.options.finished)
      await installWrapup(this.page, { ...this.options, finished: this.options.finished });
  }

  deletedPhraseIds(): Promise<number[]> {
    return this.page.evaluate(() => window.__ET_WRAPUP__.deletedIds);
  }
}
