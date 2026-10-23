import { Duration, Effect, Exit } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { updateAiSettingsAtom } from '@/core/ai-settings';
import { captureStateAtom } from '@/core/answer-capture';
import type { InputSource } from '@/core/practice-session';
import { sendTurn, turnRuntime } from '@/core/practice-turn';
import { toast } from '@/shared/ui/toast';
import {
  countdownLabel,
  countdownRemainingMs,
  startSendCountdown,
} from '../helpers/send-countdown';
import { countdownLabelAtom, draftAtom, EMPTY_DRAFT, isSendingAtom } from './draft-atoms';

const COUNTDOWN_TICK = Duration.millis(100);
const SWITCH_FAILED = 'Could not switch to Apple on-device. You can change the model in Settings.';

export type Submission = { readonly text: string; readonly source: InputSource };

function recordingMsOf(registry: AtomRegistry.AtomRegistry): number {
  const state = registry.get(captureStateAtom);
  return state.tag === 'transcript' ? state.durationMs : 0;
}

export const submitAtom = Atom.keepAlive(
  turnRuntime.fn(
    Effect.fn('submitAnswer')(function* (submission: Submission, get: Atom.FnContext) {
      const { registry } = get;
      if (registry.get(isSendingAtom)) return;
      registry.set(isSendingAtom, true);
      const exit = yield* Effect.exit(
        sendTurn(registry, {
          text: submission.text,
          source: submission.source,
          recordingMs: recordingMsOf(registry),
        }),
      ).pipe(Effect.ensuring(Effect.sync(() => registry.set(isSendingAtom, false))));
      if (Exit.isSuccess(exit)) registry.set(draftAtom, EMPTY_DRAFT);
    }),
    { concurrent: true },
  ),
);

export const countdownAtom = Atom.keepAlive(
  turnRuntime.fn(
    Effect.fn('autoSendCountdown')(function* (
      input: Submission & { readonly delayMs: number },
      get: Atom.FnContext,
    ) {
      const { registry } = get;
      const countdown = startSendCountdown(input.text, performance.now(), input.delayMs);
      yield* Effect.addFinalizer(() => Effect.sync(() => registry.set(countdownLabelAtom, null)));
      while (countdownRemainingMs(countdown, performance.now()) > 0) {
        registry.set(
          countdownLabelAtom,
          countdownLabel(countdownRemainingMs(countdown, performance.now())),
        );
        yield* Effect.sleep(COUNTDOWN_TICK);
      }
      registry.set(submitAtom, { text: input.text, source: input.source });
    }),
  ),
);

export const switchToAppleAndRetryAtom = Atom.keepAlive(
  turnRuntime.fn(
    Effect.fn('switchToAppleAndRetry')(function* (submission: Submission, get: Atom.FnContext) {
      const switched = yield* Effect.exit(
        get.setResult(updateAiSettingsAtom, { provider: 'apple' }),
      );
      if (Exit.isFailure(switched)) {
        yield* Effect.sync(() => toast.danger(SWITCH_FAILED));
        return;
      }
      get.registry.set(submitAtom, submission);
    }),
  ),
);
