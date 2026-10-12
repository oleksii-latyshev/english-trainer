import { useAtomValue } from '@effect/atom-react';
import { Effect } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useEffect, useMemo } from 'react';
import {
  audioRuntime,
  type MicrophoneSnapshot,
  type MicrophoneStatus,
  microphoneSnapshotAtom,
  preferredMicrophoneAtom,
  WarmMicrophone,
} from '@/core/audio';
import { conversationFlowAtom } from '@/core/conversation-flow';
import { type WarmSession, warmSessionOf } from './warm-session';

export type MicrophoneController = {
  status: MicrophoneStatus;
  error: string;
  setActive: (active: boolean) => void;
  pause: () => void;
  resume: () => void;
  ensure: () => WarmSession | null;
};

const OFF: MicrophoneSnapshot = { status: 'off', error: '' };

function runWarm<A>(use: (warm: WarmMicrophone['Service']) => Effect.Effect<A>): A {
  return audioRuntime.runSync(Effect.flatMap(WarmMicrophone, use));
}

function ensureSession(): WarmSession | null {
  const slot = runWarm((warm) => warm.ensure);
  return slot ? warmSessionOf(slot) : null;
}

export function useMicrophoneSession(): MicrophoneController {
  const snapshot = AsyncResult.getOrElse(useAtomValue(microphoneSnapshotAtom), () => OFF);
  const deviceId = useAtomValue(preferredMicrophoneAtom);
  const { voiceInterrupt } = useAtomValue(conversationFlowAtom);

  useEffect(() => {
    runWarm((warm) => warm.setEchoCancellation(voiceInterrupt));
  }, [voiceInterrupt]);

  useEffect(() => {
    runWarm((warm) => warm.setDeviceId(deviceId));
  }, [deviceId]);

  useEffect(() => () => runWarm((warm) => warm.setActive(false)), []);

  return useMemo(
    () => ({
      status: snapshot.status,
      error: snapshot.error,
      setActive: (active) => runWarm((warm) => warm.setActive(active)),
      pause: () => runWarm((warm) => warm.pause),
      resume: () => runWarm((warm) => warm.resume),
      ensure: ensureSession,
    }),
    [snapshot],
  );
}
