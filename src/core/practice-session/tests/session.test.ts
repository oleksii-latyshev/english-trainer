import { describe, expect, it } from 'bun:test';
import { practiceErrorAtom, practiceStateAtom } from '../model/atoms';
import {
  finishPracticeAtom,
  restorePracticeAtom,
  startMistakePracticeAtom,
  startPracticeAtom,
  transitionPhaseAtom,
} from '../model/commands';
import { aFinishedSession, aPracticeSession } from './builders';
import { makeBackend, openRegistry, until } from './harness';

const OPTIONS = {
  topic_id: 'daily_life',
  topic_custom: null,
  duration_goal_seconds: 600,
  practice_mode: 'voice',
} as const;

function opened(backend = makeBackend()) {
  const registry = openRegistry(backend);
  registry.mount(practiceStateAtom);
  registry.mount(practiceErrorAtom);
  return { registry, backend };
}

describe('restoring a conversation', () => {
  it('resumes the open session on launch', async () => {
    const { registry } = opened(makeBackend({ active: aPracticeSession({ turn_count: 3 }) }));
    registry.mount(restorePracticeAtom);
    await until(() => registry.get(practiceStateAtom).tag === 'active');
    expect(registry.get(practiceStateAtom)).toMatchObject({ sessionId: 7, turnCount: 3 });
  });

  it('settles to idle when nothing is open', async () => {
    const { registry } = opened();
    registry.mount(restorePracticeAtom);
    await until(() => registry.get(practiceStateAtom).tag === 'idle');
  });

  it('settles to idle and says why when the session cannot be read', async () => {
    const backend = makeBackend();
    backend.failing.add('get_active_practice_session');
    const { registry } = opened(backend);
    registry.mount(restorePracticeAtom);
    await until(() => registry.get(practiceErrorAtom) !== '');
    expect(registry.get(practiceStateAtom).tag).toBe('idle');
  });
});

describe('starting a conversation', () => {
  it('sends the chosen options and becomes active', async () => {
    const { registry, backend } = opened();
    registry.set(practiceStateAtom, { tag: 'idle' });
    registry.mount(startPracticeAtom);
    registry.set(startPracticeAtom, OPTIONS);
    await until(() => registry.get(practiceStateAtom).tag === 'active');
    expect(backend.calls[0]).toEqual({
      command: 'start_practice_session',
      args: { options: OPTIONS },
    });
    expect(registry.get(practiceStateAtom)).toMatchObject({
      sessionId: 12,
      question: 'Tell me about your week.',
    });
  });

  it('goes back to where it was and keeps the message when the start fails', async () => {
    const backend = makeBackend();
    backend.failing.add('start_practice_session');
    const { registry } = opened(backend);
    registry.set(practiceStateAtom, { tag: 'idle' });
    registry.mount(startPracticeAtom);
    registry.set(startPracticeAtom, OPTIONS);
    await until(() => registry.get(practiceErrorAtom) !== '');
    expect(registry.get(practiceStateAtom).tag).toBe('idle');
    expect(registry.get(practiceErrorAtom)).toBe('start_practice_session failed');
  });

  it('does not start a second conversation over an open one', async () => {
    const { registry, backend } = opened();
    registry.set(practiceStateAtom, { tag: 'idle' });
    registry.mount(startPracticeAtom);
    registry.set(startPracticeAtom, OPTIONS);
    await until(() => registry.get(practiceStateAtom).tag === 'active');
    registry.set(startPracticeAtom, OPTIONS);
    registry.set(startMistakePracticeAtom, undefined);
    expect(backend.calls.filter((call) => call.command.startsWith('start_'))).toHaveLength(1);
  });
});

describe('finishing and changing stage', () => {
  async function activeSession() {
    const context = opened();
    context.registry.set(practiceStateAtom, { tag: 'idle' });
    context.registry.mount(startPracticeAtom);
    context.registry.mount(finishPracticeAtom);
    context.registry.mount(transitionPhaseAtom);
    context.registry.set(startPracticeAtom, OPTIONS);
    await until(() => context.registry.get(practiceStateAtom).tag === 'active');
    return context;
  }

  it('keeps the wrap-up payload for the summary', async () => {
    const { registry } = await activeSession();
    registry.set(finishPracticeAtom, undefined);
    await until(() => registry.get(practiceStateAtom).tag === 'completed');
    expect(registry.get(practiceStateAtom)).toEqual({
      tag: 'completed',
      summary: aFinishedSession({ session_id: 12 }),
    });
  });

  it('stays open and says why when finishing fails', async () => {
    const { registry, backend } = await activeSession();
    backend.failing.add('finish_practice_session');
    registry.set(finishPracticeAtom, undefined);
    await until(() => registry.get(practiceErrorAtom) !== '');
    expect(registry.get(practiceStateAtom).tag).toBe('active');
  });

  it('ignores a stage change the session does not allow', async () => {
    const { registry, backend } = await activeSession();
    registry.set(transitionPhaseAtom, 'speaking_review');
    expect(backend.calls.map((call) => call.command)).not.toContain('transition_practice_phase');
  });
});
