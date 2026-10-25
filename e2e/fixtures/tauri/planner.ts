import type { Page } from '@playwright/test';
import type { AnswerPlan } from '@/core/ipc';

export type PlannerOptions = {
  failFirstPlan?: boolean;
  failFirstCue?: boolean;
  firstPlanDelayMs?: number;
  firstCueDelayMs?: number;
};
export type PlannerEdgeState = {
  requested: number;
  completed: number;
  cueWrites: number;
  cueAcknowledged: number;
};
declare global {
  interface Window {
    __ET_PLANNER__: PlannerEdgeState;
  }
}

export async function installPlanner(page: Page, options: PlannerOptions = {}) {
  await page.addInitScript((seed: PlannerOptions) => {
    const edge: PlannerEdgeState = { requested: 0, completed: 0, cueWrites: 0, cueAcknowledged: 0 };
    window.__ET_PLANNER__ = edge;
    const cues = new Set<string>();
    const plans = new Map<string, Promise<AnswerPlan>>();
    const failedPlans = new Set<string>();
    const original = window.__TAURI_INTERNALS__.invoke;
    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    function plan(sequence: number): AnswerPlan {
      return {
        frame: ['Name the tool', 'Explain why it helps', 'Give one concrete example'],
        phrases: ['One tool I use is', 'It helps me because', 'For example'],
        model_answer:
          sequence === 1
            ? 'One tool I use is a notebook. It helps me keep my ideas together.'
            : 'I chose a calendar because it saves time. For example, it reminds me about meetings.',
        adaptation: 'One tool I use is [a tool]. It helps me [a benefit].',
      };
    }
    function current(sessionId: unknown, sequence: unknown) {
      const session = window.__ET_HARNESS__.activeSession;
      if (!session || session.session_id !== sessionId || session.turn_count + 1 !== sequence)
        throw { code: 'invalid_request', message: 'The question changed. Open current help.' };
      return session;
    }
    async function generate(args: Record<string, unknown>) {
      current(args.session_id, args.sequence);
      if (typeof args.sequence !== 'number') throw new Error('Invalid plan sequence');
      const request = ++edge.requested;
      const result = plan(args.sequence);
      if (request === 1 && seed.firstPlanDelayMs) await delay(seed.firstPlanDelayMs);
      if (request === 1 && seed.failFirstPlan)
        throw {
          code: 'rate_limited',
          message: 'Help is temporarily unavailable. Retry later or keep speaking.',
        };
      edge.completed += 1;
      return result;
    }
    function prepare(args: Record<string, unknown>) {
      current(args.session_id, args.sequence);
      window.__ET_HARNESS__.calls.push({ command: 'prefetch_answer_plan', args });
      const key = `${args.session_id}:${args.sequence}:${args.question}`;
      const cached = plans.get(key);
      if (cached && !(args.retry === true && failedPlans.has(key))) return cached;
      failedPlans.delete(key);
      const pending = generate(args).catch((error: unknown) => {
        failedPlans.add(key);
        throw error;
      });
      plans.set(key, pending);
      return pending;
    }
    async function markHelp(args: Record<string, unknown>) {
      const session = current(args.sessionId, args.sequence);
      window.__ET_HARNESS__.calls.push({ command: 'record_answer_help_used', args });
      edge.cueWrites += 1;
      if (edge.cueWrites === 1 && seed.failFirstCue)
        throw { code: 'database_error', message: 'Help could not be marked. Try again.' };
      cues.add(`${session.session_id}:${args.sequence}`);
      if (edge.cueWrites === 1 && seed.firstCueDelayMs) await delay(seed.firstCueDelayMs);
      edge.cueAcknowledged += 1;
      return null;
    }
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command === 'prefetch_answer_plan') return prepare(args);
      if (command === 'record_answer_help_used') return markHelp(args);
      const result = await original(command, args);
      if (command === 'send_practice_turn' && window.__ET_HARNESS__.dialogue) {
        const dialogue = window.__ET_HARNESS__.dialogue;
        dialogue.help_used = dialogue.turns.map((_, index) =>
          cues.has(`${dialogue.session_id}:${index + 1}`),
        );
      }
      return result;
    };
  }, options);
}

export class PlannerBackend {
  private options: PlannerOptions = {};

  constructor(private readonly page: Page) {}

  failingFirstPlan(): this {
    this.options = { ...this.options, failFirstPlan: true };
    return this;
  }

  failingFirstCue(): this {
    this.options = { ...this.options, failFirstCue: true };
    return this;
  }

  delayingFirstPlanBy(ms: number): this {
    this.options = { ...this.options, firstPlanDelayMs: ms };
    return this;
  }

  delayingFirstCueBy(ms: number): this {
    this.options = { ...this.options, firstCueDelayMs: ms };
    return this;
  }

  get seed(): PlannerOptions {
    return this.options;
  }

  state(): Promise<PlannerEdgeState> {
    return this.page.evaluate(() => window.__ET_PLANNER__);
  }
}
