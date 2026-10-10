import { microphoneError } from './microphoneError';
import {
  createMicrophoneSession,
  type MicrophoneSession,
  type MicrophoneSessionOptions,
} from './microphoneSession';

export type MicrophoneStatus = 'off' | 'opening' | 'warming' | 'ready' | 'paused' | 'error';
export type MicrophoneSnapshot = { status: MicrophoneStatus; error: string };
export type MicrophoneSessionFactory = (options: MicrophoneSessionOptions) => MicrophoneSession;

export type MicrophoneManager = {
  /** Practice is running: the microphone stays warm unless the user paused it. */
  setActive: (active: boolean) => void;
  /** Reopens the stream on the new device if one is open. `undefined` follows the stored preference. */
  setDeviceId: (deviceId: string | undefined) => void;
  /** Reopens a warm session when the requested processing mode changes. */
  setEchoCancellation: (enabled: boolean) => void;
  /** Releases the device until `resume` or `ensure`. */
  pause: () => void;
  resume: () => void;
  /** The warm session, reopening it first if it was paused or failed. Null when no practice is active. */
  ensure: () => MicrophoneSession | null;
  getSnapshot: () => MicrophoneSnapshot;
  subscribe: (listener: () => void) => () => void;
};

type Phase = 'opening' | 'warming' | 'ready';

/**
 * Owns the lifetime of the warm microphone session outside React so that event handlers can
 * reopen it synchronously. Failures close the session and surface as an error status; they do not
 * retry on their own.
 */
export function createMicrophoneManager(
  factory: MicrophoneSessionFactory = createMicrophoneSession,
): MicrophoneManager {
  const listeners = new Set<() => void>();
  let active = false;
  let paused = false;
  let deviceId: string | undefined;
  let echoCancellation = false;
  let session: MicrophoneSession | null = null;
  let phase: Phase = 'opening';
  let failure = '';
  let snapshot: MicrophoneSnapshot = { status: 'off', error: '' };

  function computeStatus(): MicrophoneStatus {
    if (!active) return 'off';
    if (paused) return 'paused';
    if (session) return phase;
    return failure ? 'error' : 'opening';
  }

  function publish() {
    const next = { status: computeStatus(), error: failure };
    if (next.status === snapshot.status && next.error === snapshot.error) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  function closeCurrent() {
    const closing = session;
    session = null;
    // The device is being released on purpose; a teardown error has nothing left to affect.
    void closing?.close().catch(() => {});
  }

  function open() {
    phase = 'opening';
    const created: MicrophoneSession = factory({
      deviceId,
      echoCancellation,
      hooks: {
        onWarm: () => {
          if (session !== created) return;
          phase = 'ready';
          publish();
        },
        onFailure: (error) => {
          if (session !== created) return;
          session = null;
          failure = microphoneError(error);
          publish();
        },
      },
    });
    session = created;
    created.opened.then(
      () => {
        if (session !== created || phase !== 'opening') return;
        phase = 'warming';
        publish();
      },
      () => {
        // Reported through the failure hook.
      },
    );
  }

  function reconcile() {
    if (active && !paused) {
      if (!session && !failure) open();
    } else {
      closeCurrent();
    }
    publish();
  }

  return {
    setActive(next) {
      if (active === next) return;
      active = next;
      if (!next) {
        paused = false;
        failure = '';
      }
      reconcile();
    },
    setDeviceId(next) {
      if (deviceId === next) return;
      deviceId = next;
      if (!session) return;
      closeCurrent();
      reconcile();
    },
    setEchoCancellation(next) {
      if (echoCancellation === next) return;
      echoCancellation = next;
      if (!session) return;
      closeCurrent();
      reconcile();
    },
    pause() {
      if (!active || paused) return;
      paused = true;
      reconcile();
    },
    resume() {
      if (!active) return;
      paused = false;
      failure = '';
      reconcile();
    },
    ensure() {
      if (!active) return null;
      if (paused || failure) {
        paused = false;
        failure = '';
        reconcile();
      }
      return session;
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
