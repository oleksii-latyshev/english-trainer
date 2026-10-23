import type { InputSource } from '@/core/practice-session';

export type InputSourceParams = {
  draft: string;
  recognizedText?: string;
  isNewVoice: boolean;
};

export type SendGate = {
  isBusy: boolean;
  isCapturing: boolean;
  isLocked: boolean;
  isSending: boolean;
};

export function canSendDraft(gate: SendGate): boolean {
  return !(gate.isBusy || gate.isCapturing || gate.isLocked || gate.isSending);
}

export function shouldAutoSendVoiceTranscript(params: {
  transcript: string;
  requestId: number;
  processedRequestId?: number;
  autoSendVoice: boolean;
  canSend: boolean;
}): boolean {
  return (
    Boolean(params.transcript.trim()) &&
    params.requestId !== params.processedRequestId &&
    params.autoSendVoice &&
    params.canSend
  );
}

export function resolveInputSource({
  draft,
  recognizedText,
  isNewVoice,
}: InputSourceParams): InputSource {
  const trimmedDraft = draft.trim();
  const trimmedVoice = recognizedText?.trim();

  if (isNewVoice && trimmedVoice) {
    return trimmedDraft === trimmedVoice ? 'voice' : 'edited';
  }
  return 'text';
}
