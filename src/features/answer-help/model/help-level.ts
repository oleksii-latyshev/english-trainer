import { Effect } from 'effect';
import type { Atom, AtomRegistry } from 'effect/reactivity';
import { isTauriRuntime } from '@/core/ipc';
import { sessionDetailsAtom } from '@/core/practice-session';
import { exampleCueWasInterrupted } from '../helpers/example-guard';
import { HELP_NOT_MARKED } from '../helpers/help-copy';
import { helpTargetOf } from '../helpers/help-key';
import type { HelpLevel } from '../helpers/help-levels';
import { AnswerHelpService } from '../services/answer-help-service';
import type { OpenRequest } from '../types';
import {
  captureEpochAtom,
  helpChoiceAtom,
  helpKeyAtom,
  helpNoticeStoreAtom,
  helpRequestAtom,
  isCaptureStartedAtom,
  requestedLevelAtom,
} from './atoms';
import { runtime } from './runtime';

type Registry = AtomRegistry.AtomRegistry;

export function selectLevel(registry: Registry, key: string, level: HelpLevel | null) {
  registry.set(helpChoiceAtom, { key, level });
}

export function supersedePendingOpen(registry: Registry): number {
  const request = registry.get(helpRequestAtom) + 1;
  registry.set(helpRequestAtom, request);
  return request;
}

function isStale(registry: Registry, open: OpenRequest): boolean {
  return (
    registry.get(helpRequestAtom) !== open.request || registry.get(helpKeyAtom) !== open.target.key
  );
}

function settleOpened(registry: Registry, open: OpenRequest) {
  if (isStale(registry, open)) return;
  registry.set(requestedLevelAtom, null);
  const interrupted = exampleCueWasInterrupted(
    open.wasCapturing,
    open.captureEpoch,
    registry.get(captureEpochAtom),
    registry.get(isCaptureStartedAtom),
  );
  const hidden = open.level === 'example' && interrupted;
  selectLevel(registry, open.target.key, hidden ? null : open.level);
}

function settleNotMarked(registry: Registry, open: OpenRequest) {
  if (isStale(registry, open)) return;
  registry.set(requestedLevelAtom, null);
  selectLevel(registry, open.target.key, null);
  registry.set(helpNoticeStoreAtom, { key: open.target.key, text: HELP_NOT_MARKED });
}

export const openHelpAtom = runtime.fn(
  Effect.fn('openAnswerHelp')(function* (open: OpenRequest, get: Atom.FnContext) {
    const service = yield* AnswerHelpService;
    const { registry } = get;
    yield* service.recordUsed(open.target).pipe(
      Effect.matchEffect({
        onSuccess: () => Effect.sync(() => settleOpened(registry, open)),
        onFailure: () => Effect.sync(() => settleNotMarked(registry, open)),
      }),
    );
  }),
);

export function changeHelpLevel(registry: Registry, level: HelpLevel | null) {
  const isCapturing = registry.get(isCaptureStartedAtom);
  if (level === 'example' && isCapturing) return;
  const request = supersedePendingOpen(registry);
  const key = registry.get(helpKeyAtom);
  const target = helpTargetOf(registry.get(sessionDetailsAtom));
  if (level === null || target === null) {
    registry.set(requestedLevelAtom, null);
    selectLevel(registry, key, null);
    return;
  }
  registry.set(requestedLevelAtom, level);
  registry.set(helpNoticeStoreAtom, null);
  if (!isTauriRuntime()) {
    registry.set(requestedLevelAtom, null);
    selectLevel(registry, key, level);
    return;
  }
  registry.set(openHelpAtom, {
    level,
    target,
    request,
    captureEpoch: registry.get(captureEpochAtom),
    wasCapturing: isCapturing,
  });
}
