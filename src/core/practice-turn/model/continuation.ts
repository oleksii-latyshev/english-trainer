import type { AtomRegistry } from 'effect/reactivity';
import { practiceStateAtom, sessionDetails } from '@/core/practice-session';
import { isJoinWindowOpen, joinAnswers } from '../helpers/join-window';
import type { JoinWindow, SendInput } from '../types';
import { continuationAtom, joinWindowAtom } from './state';

export function openJoinWindow(registry: AtomRegistry.AtomRegistry, window: JoinWindow) {
  registry.set(joinWindowAtom, window);
}

export function closeJoinWindow(registry: AtomRegistry.AtomRegistry) {
  if (registry.get(joinWindowAtom) !== null) registry.set(joinWindowAtom, null);
}

export function currentJoinWindow(registry: AtomRegistry.AtomRegistry): JoinWindow | null {
  const window = registry.get(joinWindowAtom);
  if (window === null) return null;
  const isOpen = isJoinWindowOpen(window.openedAtMs, performance.now());
  const sessionId = sessionDetails(registry.get(practiceStateAtom))?.sessionId;
  if (isOpen && window.sessionId === sessionId) return window;
  closeJoinWindow(registry);
  return null;
}

export function withContinuation(registry: AtomRegistry.AtomRegistry, input: SendInput): SendInput {
  const continuation = registry.get(continuationAtom);
  const sessionId = sessionDetails(registry.get(practiceStateAtom))?.sessionId;
  if (continuation === null || continuation.sessionId !== sessionId || input.source === 'text') {
    return input;
  }
  return {
    ...input,
    text: joinAnswers(continuation.transcript, input.text),
    recordingMs: continuation.recordingMs + input.recordingMs,
    continuesTurn: continuation.sequence,
  };
}
