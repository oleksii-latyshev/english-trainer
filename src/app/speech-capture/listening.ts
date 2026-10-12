import type { Dispatch, SetStateAction } from 'react';
import type { MicrophoneController, WarmSession } from '@/app/microphone';
import { type PcmRecorder, startPcmRecording } from '@/app/microphone';
import { readConversationFlow } from '@/core/conversation-flow';
import type { SpeechControls } from '@/core/speech';
import { type CaptureState, preRollMsFor, type RecordingMode } from './capture-view';
import { watchLiveText } from './live-text';
import { startWarmRecording } from './warm-recorder';

const ELAPSED_TICK_MS = 100;
const AUTO_LISTEN_IDLE_MS = 20_000;
const AUTO_SETTLE_MS = 300;

export function isAssistantSpeaking(speech: SpeechControls): boolean {
  const tag = speech.state.tag;
  return tag === 'speaking' || tag === 'starting' || tag === 'paused';
}

export function sessionFor(
  controller: MicrophoneController | undefined,
  mode: RecordingMode,
): WarmSession | null {
  if (!controller) return null;
  if (mode === 'auto') {
    const status = controller.status;
    if (!readConversationFlow().autoListen) return null;
    if (status !== 'opening' && status !== 'warming' && status !== 'ready') return null;
  }
  return controller.ensure();
}

export function openRecorder(
  session: WarmSession | null,
  options: { mode: RecordingMode; assistantWasSpeaking: boolean; onDeviceLost: () => void },
): Promise<PcmRecorder> {
  if (!session) return startPcmRecording(options.onDeviceLost);
  return startWarmRecording(session, {
    preRollMs: preRollMsFor(options.mode, options.assistantWasSpeaking),
    onDeviceLost: options.onDeviceLost,
  });
}

export type TurnWatch = {
  setHold: (held: boolean) => void;
  dispose: () => void;
};

export function watchActiveTurn(
  session: WarmSession,
  recorder: PcmRecorder,
  mode: RecordingMode,
  options: {
    setState: Dispatch<SetStateAction<CaptureState>>;
    onTurnEnded: () => void;
    onIdleTimeout: () => void;
    isCurrent: () => boolean;
  },
): TurnWatch {
  return watchTurn(
    session,
    recorder,
    mode,
    {
      onLiveText: (liveText) =>
        options.setState((current) =>
          current.tag === 'recording' ? { ...current, liveText } : current,
        ),
      onSpeechStarted: () =>
        options.setState((current) =>
          current.tag === 'recording' ? { ...current, heardSpeech: true } : current,
        ),
      onTurnEnded: options.onTurnEnded,
      onIdleTimeout: options.onIdleTimeout,
    },
    options.isCurrent,
  );
}

export function watchTurn(
  session: WarmSession,
  recorder: PcmRecorder,
  mode: RecordingMode,
  handlers: {
    onSpeechStarted: () => void;
    onTurnEnded: () => void;
    onIdleTimeout: () => void;
    onLiveText: (text: string) => void;
  },
  isCurrent: () => boolean,
): TurnWatch {
  let hasHeardSpeech = false;
  const stopLiveText = watchLiveText(recorder.capture, () => hasHeardSpeech, handlers.onLiveText);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  function clearIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }
  const listening = session.listenForTurn(
    {
      endPauseMs: readConversationFlow().endPauseMs,
      settleMs: mode === 'auto' ? AUTO_SETTLE_MS : 0,
    },
    {
      onSpeechStarted: () => {
        hasHeardSpeech = true;
        clearIdle();
        handlers.onSpeechStarted();
      },
      onTurnEnded: () => {
        if (isCurrent() && readConversationFlow().handsFree) handlers.onTurnEnded();
      },
    },
  );
  function scheduleIdle() {
    if (mode !== 'auto' || hasHeardSpeech || idleTimer) return;
    idleTimer = setTimeout(() => {
      if (isCurrent()) handlers.onIdleTimeout();
    }, AUTO_LISTEN_IDLE_MS);
  }
  scheduleIdle();
  return {
    setHold: (held) => {
      listening.setHold(held);
      if (held) clearIdle();
      else scheduleIdle();
    },
    dispose: () => {
      clearIdle();
      stopLiveText();
      listening.dispose();
    },
  };
}

export function startElapsedTimer(
  recorder: PcmRecorder,
  startedAtMs: number,
  update: (elapsedMs: number, level: number) => void,
): ReturnType<typeof setInterval> {
  return setInterval(
    () => update(performance.now() - startedAtMs, recorder.level()),
    ELAPSED_TICK_MS,
  );
}
