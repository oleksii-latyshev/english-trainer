// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { createMicrophoneManager } from './microphoneManager';
import type { MicrophoneSession, MicrophoneSessionOptions } from './microphoneSession';

type FakeSession = MicrophoneSession & {
  closed: boolean;
  options: MicrophoneSessionOptions;
  finishOpen: () => void;
};

function harness() {
  const sessions: FakeSession[] = [];
  const factory = (options: MicrophoneSessionOptions): MicrophoneSession => {
    let finishOpen: () => void = () => {};
    const opened = new Promise<{ deviceId: string; label: string }>((resolve) => {
      finishOpen = () => resolve({ deviceId: '', label: 'Fake' });
    });
    const session = {
      options,
      closed: false,
      finishOpen,
      opened,
      whenWarm: () => Promise.resolve(),
      isWarm: () => false,
      level: () => 0,
      noiseFloor: () => 0,
      subscribeFrames: () => () => {},
      beginCapture: () => {
        throw new Error('not used');
      },
      close: async () => {
        session.closed = true;
      },
    };
    sessions.push(session);
    return session;
  };
  return { sessions, manager: createMicrophoneManager(factory) };
}

describe('microphone manager', () => {
  it('opens only while practice is active and releases the device when it ends', () => {
    const { manager, sessions } = harness();
    expect(manager.ensure()).toBeNull();
    manager.setActive(true);
    expect(sessions).toHaveLength(1);
    expect(manager.getSnapshot().status).toBe('opening');
    manager.setActive(false);
    expect(sessions[0].closed).toBe(true);
    expect(manager.getSnapshot().status).toBe('off');
  });

  it('moves through warming to ready as the session reports progress', async () => {
    const { manager, sessions } = harness();
    manager.setActive(true);
    sessions[0].finishOpen();
    await sessions[0].opened;
    expect(manager.getSnapshot().status).toBe('warming');
    sessions[0].options.hooks?.onWarm?.();
    expect(manager.getSnapshot().status).toBe('ready');
  });

  it('pause releases the device and ensure reopens it synchronously', () => {
    const { manager, sessions } = harness();
    manager.setActive(true);
    manager.pause();
    expect(sessions[0].closed).toBe(true);
    expect(manager.getSnapshot().status).toBe('paused');
    const reopened = manager.ensure();
    expect(reopened).toBe(sessions[1] ?? null);
    expect(sessions).toHaveLength(2);
    expect(manager.getSnapshot().status).toBe('opening');
  });

  it('reports a failure once and retries only when asked', () => {
    const { manager, sessions } = harness();
    manager.setActive(true);
    sessions[0].options.hooks?.onFailure?.(new Error('The microphone did not become ready.'));
    expect(manager.getSnapshot()).toEqual({
      status: 'error',
      error: 'The microphone did not become ready.',
    });
    expect(sessions).toHaveLength(1);
    manager.resume();
    expect(sessions).toHaveLength(2);
    expect(manager.getSnapshot().error).toBe('');
  });

  it('ignores callbacks from a session that was replaced', () => {
    const { manager, sessions } = harness();
    manager.setActive(true);
    manager.setDeviceId('usb');
    expect(sessions[0].closed).toBe(true);
    expect(sessions[1].options.deviceId).toBe('usb');
    sessions[0].options.hooks?.onFailure?.(new Error('late'));
    expect(manager.getSnapshot().status).toBe('opening');
  });

  it('notifies subscribers only when the snapshot changes', () => {
    const { manager } = harness();
    let calls = 0;
    const unsubscribe = manager.subscribe(() => {
      calls += 1;
    });
    manager.setActive(true);
    manager.setActive(true);
    expect(calls).toBe(1);
    unsubscribe();
    manager.setActive(false);
    expect(calls).toBe(1);
  });
});
