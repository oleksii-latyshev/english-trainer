import type { Page } from '@playwright/test';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import type { FinishedPracticeSession } from '@/lib/finishedPracticeSession';
import type { PracticeOptions } from '@/lib/practiceOptions';
import type { PracticeSession } from '@/lib/practiceSessionTypes';

export class SessionBackend {
  open: PracticeSession | null = null;
  openDialogue: PracticeDialogue | undefined;
  failsNextStart = false;
  failsNextSend = false;
  failsNextTransition = false;

  constructor(private readonly page: Page) {}

  withOpenSession(session: PracticeSession, dialogue?: PracticeDialogue): this {
    this.open = session;
    this.openDialogue = dialogue;
    return this;
  }

  failingNextStart(): this {
    this.failsNextStart = true;
    return this;
  }

  failingNextSend(): this {
    this.failsNextSend = true;
    return this;
  }

  failingNextTransition(): this {
    this.failsNextTransition = true;
    return this;
  }

  activeSession(): Promise<PracticeSession | null> {
    return this.page.evaluate(() => window.__ET_HARNESS__.activeSession);
  }

  dialogue(): Promise<PracticeDialogue | null> {
    return this.page.evaluate(() => window.__ET_HARNESS__.dialogue);
  }

  finished(): Promise<FinishedPracticeSession | null> {
    return this.page.evaluate(() => window.__ET_HARNESS__.finished);
  }

  lastOptions(): Promise<PracticeOptions | null> {
    return this.page.evaluate(() => window.__ET_HARNESS__.lastOptions);
  }
}
