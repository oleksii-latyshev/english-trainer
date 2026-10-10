import type { MicrophoneSession } from '@/audio/microphoneSession';
import { type PcmRecorder, startPcmRecording } from '@/audio/recordPcm';
import { listenForTurn } from '@/audio/turnListening';
import type { MicrophoneController } from '@/audio/useMicrophoneSession';
import { getConversationFlow } from '@/lib/conversationFlowPreferences';
import { preRollMsFor, type RecordingMode } from './captureView';
import { startLiveTranscript } from './liveTranscript';
import type { useSystemSpeech } from './useSystemSpeech';
import { startWarmRecording } from './warmRecorder';

const ELAPSED_TICK_MS = 100;
const AUTO_LISTEN_IDLE_MS = 20_000;
// Ignore the first moments of auto-listening: the room may still ring with the assistant's voice.
const AUTO_SETTLE_MS = 300;

export function isAssistantSpeaking(speech: ReturnType<typeof useSystemSpeech>): boolean {
  const tag = speech.state.tag;
  return tag === 'speaking' || tag === 'starting' || tag === 'paused';
}

/**
 * The warm session if there is one to use. Auto-listening needs its preference on and never
 * reopens a paused microphone.
 */
export function sessionFor(
  controller: MicrophoneController | undefined,
  mode: RecordingMode,
): MicrophoneSession | null {
  if (!controller) return null;
  if (mode === 'auto') {
    const status = controller.status;
    if (!getConversationFlow().autoListen) return null;
    if (status !== 'opening' && status !== 'warming' && status !== 'ready') return null;
  }
  return controller.ensure();
}

export function openRecorder(
  session: MicrophoneSession | null,
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

/**
 * Watches the warm session for the end of the user's turn, and shows the words heard so far
 * (only the practice conversation does; other recordings are read once, after the fact).
 * Auto-listening also gives up quietly if nobody speaks for a while.
 */
export function watchTurn(
  session: MicrophoneSession,
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
  const stopLiveText = startLiveTranscript(recorder, () => hasHeardSpeech, handlers.onLiveText);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const clearIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  };
  const listening = listenForTurn(
    session,
    {
      endPauseMs: getConversationFlow().endPauseMs,
      settleMs: mode === 'auto' ? AUTO_SETTLE_MS : 0,
    },
    {
      onSpeechStarted: () => {
        hasHeardSpeech = true;
        clearIdle();
        handlers.onSpeechStarted();
      },
      onTurnEnded: () => {
        if (isCurrent() && getConversationFlow().handsFree) handlers.onTurnEnded();
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

/** Updates the live elapsed time and input level of the active recording. */
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
