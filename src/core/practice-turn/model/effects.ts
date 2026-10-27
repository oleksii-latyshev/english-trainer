import { Effect } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { prewarmConversationProviderAtom } from '@/core/ai-settings';
import {
  canChangeSession,
  captureStateAtom,
  resetCapture,
  startListening,
} from '@/core/answer-capture';
import { preferredMicrophoneAtom, WarmMicrophone } from '@/core/audio';
import { conversationFlowAtom } from '@/core/conversation-flow';
import { isTauriRuntime } from '@/core/ipc';
import {
  canSendPracticeStage,
  practiceKeepsMicrophoneWarm,
  practiceStageUsesAudio,
  practiceStateAtom,
  sessionDetails,
} from '@/core/practice-session';
import { createPlayback, SpeechRecognition } from '@/core/speech';
import { discardPendingReply } from './interrupt';
import { turnRuntime } from './runtime';
import { generationAtom, planningAtom, replyEndedAtom, turnLockAtom } from './state';

const micWantedAtom = Atom.make((get) => {
  const state = get(practiceStateAtom);
  return (state.tag === 'active' || state.tag === 'waiting') && practiceKeepsMicrophoneWarm(state);
});

const voiceInterruptAtom = Atom.make((get) => get(conversationFlowAtom).voiceInterrupt);

const sessionKeyAtom = Atom.make((get) => {
  const session = sessionDetails(get(practiceStateAtom));
  return session === undefined
    ? null
    : `${session.sessionId}:${session.practiceMode}:${session.practicePhase}`;
});

const openSessionIdAtom = Atom.make((get) => sessionDetails(get(practiceStateAtom))?.sessionId);

const isMistakePracticeAtom = Atom.make(
  (get) => sessionDetails(get(practiceStateAtom))?.isMistakePractice === true,
);

const warmsSpeechEngineAtom = Atom.make((get) => {
  const session = sessionDetails(get(practiceStateAtom));
  if (session === undefined) return false;
  return (
    session.practiceMode === 'voice' ||
    (session.practiceMode === 'write_then_speak' && session.practicePhase === 'speaking')
  );
});

const lastSessionKeyAtom = Atom.make<string | null | undefined>(undefined);

function autoListenReady(registry: AtomRegistry.AtomRegistry): boolean {
  const state = registry.get(practiceStateAtom);
  if (state.tag !== 'active') return false;
  return (
    practiceStageUsesAudio(state) &&
    canSendPracticeStage(state) &&
    !registry.get(turnLockAtom) &&
    canChangeSession(registry.get(captureStateAtom))
  );
}

export const warmMicrophoneAtom = turnRuntime.atom((get) => {
  const wanted = get(micWantedAtom);
  return Effect.flatMap(WarmMicrophone, (warm) => warm.setActive(wanted));
});

export const releaseMicrophoneAtom = turnRuntime.atom(
  Effect.flatMap(WarmMicrophone, (warm) => Effect.addFinalizer(() => warm.setActive(false))),
);

export const echoCancellationAtom = turnRuntime.atom((get) => {
  const enabled = get(voiceInterruptAtom);
  return Effect.flatMap(WarmMicrophone, (warm) => warm.setEchoCancellation(enabled));
});

export const microphoneDeviceAtom = turnRuntime.atom((get) => {
  const deviceId = get(preferredMicrophoneAtom);
  return Effect.flatMap(WarmMicrophone, (warm) => warm.setDeviceId(deviceId));
});

export const stageResetAtom = Atom.make((get) => {
  const key = get(sessionKeyAtom);
  const previous = get.registry.get(lastSessionKeyAtom);
  get.registry.set(lastSessionKeyAtom, key);
  if (previous === undefined || previous === key) return;
  createPlayback(get.registry).stop();
  discardPendingReply(get.registry);
  resetCapture(get.registry);
});

export const prewarmAtom = turnRuntime.atom((get) => {
  const sessionId = get(openSessionIdAtom);
  const isMistakePractice = get(isMistakePracticeAtom);
  const warmsSpeech = get(warmsSpeechEngineAtom);
  if (sessionId === undefined || !isTauriRuntime()) return Effect.void;
  if (!isMistakePractice) {
    get.mount(prewarmConversationProviderAtom);
    get.registry.set(prewarmConversationProviderAtom, undefined);
  }
  if (!warmsSpeech) return Effect.void;
  return Effect.flatMap(SpeechRecognition, (recognition) => recognition.warm).pipe(Effect.ignore);
});

export const autoListenAtom = Atom.make((get) => {
  const { registry } = get;
  const ended = get(replyEndedAtom);
  if (ended === 0 || ended !== registry.get(generationAtom)) return;
  if (registry.get(planningAtom) || !autoListenReady(registry)) return;
  startListening(registry, { mode: 'auto', discardPreRoll: false });
});
