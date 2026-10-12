import type { Page } from '@playwright/test';
import type { AiSettings } from '@/core/ipc';

export type AiSettingsOptions = {
  settings?: AiSettings;
  failNextSave?: boolean;
  failTest?: boolean;
  usage?: boolean;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  agy_model: 'default',
  eva_style: 'natural',
};

export async function installAiSettings(page: Page, options: AiSettingsOptions = {}) {
  await page.addInitScript(
    (seed: AiSettingsOptions & { defaults: AiSettings }) => {
      const internals = window.__TAURI_INTERNALS__;
      const original = internals.invoke;
      const callbacks = new Map<number, (event: unknown) => void>();
      const register = internals.transformCallback;
      internals.transformCallback = (callback, once) => {
        const id = register(callback, once);
        callbacks.set(id, callback);
        return id;
      };
      let settings: AiSettings = seed.settings ?? seed.defaults;
      let failNextSave = seed.failNextSave ?? false;
      const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
      function channelId(value: unknown): number | undefined {
        if (typeof value === 'object' && value !== null) {
          const id: unknown = Reflect.get(value, 'id');
          if (typeof id === 'number') return id;
        }
        return undefined;
      }
      function record(command: string, args: Record<string, unknown>) {
        window.__ET_HARNESS__.calls.push({ command, args });
      }
      async function generate(args: Record<string, unknown>) {
        const id = channelId(args.onReply);
        const callback = id === undefined ? undefined : callbacks.get(id);
        await delay(40);
        callback?.({ index: 0, message: { kind: 'delta', text: 'Nice to meet you. ' } });
        await delay(40);
        if (seed.failTest) {
          throw {
            code: 'unauthorized',
            message: 'No Gemini API key is set. Add one in Settings, or choose another provider.',
          };
        }
        callback?.({ index: 1, message: { kind: 'delta', text: 'What do you do?' } });
        return {
          spoken_reply: 'Nice to meet you.',
          question: 'What do you do?',
          session_phase: 'warmup',
          is_complete: false,
          provider_latency_ms: 1400,
          first_token_ms: 620,
          answered_by: { provider: 'gemini', model: 'gemini-3.5-flash-lite', is_backup: false },
        };
      }
      function save(args: Record<string, unknown>) {
        if (failNextSave) {
          failNextSave = false;
          throw {
            code: 'database_error',
            message: 'Could not read or save conversation settings locally. Please retry.',
          };
        }
        settings = args.settings as AiSettings;
        return settings;
      }
      function usage() {
        return {
          day: '2026-10-12',
          gemini: {
            models: [
              { model: 'gemini-3.5-flash-lite', requests: 142 },
              { model: 'gemini-3.5-flash', requests: 40 },
            ],
            last_limit: null,
            resets_at_ms: Date.now() + 7 * 3_600_000 + 12 * 60_000,
          },
          antigravity: { requests_today: 18, last_quota_error: null },
        };
      }
      const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
        get_ai_settings: () => settings,
        save_ai_settings: save,
        generate_follow_up: generate,
      };
      if (seed.usage) handlers.get_api_usage = usage;
      internals.invoke = async (command, args = {}) => {
        const handler = handlers[command];
        if (!handler) return original(command, args);
        record(command, args);
        return handler(args);
      };
    },
    { ...options, defaults: DEFAULT_AI_SETTINGS },
  );
}
