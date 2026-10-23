import { Atom, type AtomRegistry } from 'effect/reactivity';
import { conversationFlowAtom, effectiveAutoSendDelayMs } from '@/core/conversation-flow';
import { canSendDraft, shouldAutoSendVoiceTranscript } from '../helpers/input-source';
import { autoSendAction } from '../helpers/send-countdown';
import { cancelCountdown } from './commands';
import { draftAtom, draftScopeAtom, isSendingAtom, processedRequestAtom } from './draft-atoms';
import { countdownAtom, submitAtom } from './submit';
import {
  composerTranscriptAtom,
  isCapturingAudioAtom,
  isLockedAtom,
  isPracticeBusyAtom,
} from './view-atoms';

type Transcript = { readonly requestId: number; readonly text: string };

function adopt(registry: AtomRegistry.AtomRegistry, transcript: Transcript) {
  registry.set(draftAtom, {
    text: transcript.text,
    recognizedText: transcript.text,
    isNewVoice: true,
  });
}

function canSendNow(registry: AtomRegistry.AtomRegistry): boolean {
  return canSendDraft({
    isBusy: registry.get(isPracticeBusyAtom),
    isCapturing: registry.get(isCapturingAudioAtom),
    isLocked: registry.get(isLockedAtom),
    isSending: registry.get(isSendingAtom),
  });
}

function autoSend(registry: AtomRegistry.AtomRegistry, transcript: Transcript) {
  const flow = registry.get(conversationFlowAtom);
  const delayMs = effectiveAutoSendDelayMs(flow);
  const submission = { text: transcript.text, source: 'voice' } as const;
  if (autoSendAction(delayMs) === 'send-now') registry.set(submitAtom, submission);
  else registry.set(countdownAtom, { ...submission, delayMs });
}

export const adoptExistingTranscriptAtom = Atom.make((get) => {
  const transcript = get.registry.get(composerTranscriptAtom);
  if (transcript === null) return;
  if (get.registry.get(processedRequestAtom) !== transcript.requestId)
    adopt(get.registry, transcript);
  get.registry.set(processedRequestAtom, transcript.requestId);
});

export const transcriptSyncAtom = Atom.make((get) => {
  const transcript = get(composerTranscriptAtom);
  if (transcript === null) return;
  const { registry } = get;
  const processed = registry.get(processedRequestAtom);
  if (processed === transcript.requestId) return;
  adopt(registry, transcript);
  const shouldSend = shouldAutoSendVoiceTranscript({
    transcript: transcript.text,
    requestId: transcript.requestId,
    processedRequestId: processed,
    autoSendVoice: registry.get(conversationFlowAtom).autoSendVoice,
    canSend: canSendNow(registry),
  });
  registry.set(processedRequestAtom, transcript.requestId);
  if (shouldSend) autoSend(registry, transcript);
});

export const countdownScopeAtom = Atom.make((get) => {
  get(draftScopeAtom);
  cancelCountdown(get.registry);
});
