export type InputSource = 'voice' | 'edited' | 'text';

export type InputSourceParams = {
  draft: string;
  recognizedText?: string;
  isNewVoice: boolean;
};

export type PracticeSendState = {
  busy: boolean;
  isRecording: boolean;
  transcribing: boolean;
  disabled: boolean;
  isRetrying: boolean;
  recallActive: boolean;
  isSending: boolean;
};

export function canSendPracticeInput(state: PracticeSendState): boolean {
  return !(
    state.busy ||
    state.isRecording ||
    state.transcribing ||
    state.disabled ||
    state.isRetrying ||
    state.recallActive ||
    state.isSending
  );
}

/**
 * The capture transcript the composer may see. While "Say it again" is running the shared capture
 * belongs to the second try, whose words are compared inside the note and never become an answer.
 */
export function composerTranscript(
  transcript: string | undefined,
  isRetrying: boolean,
): string | undefined {
  return isRetrying ? undefined : transcript;
}

export function shouldAutoSendVoiceTranscript(params: {
  transcript: string;
  requestId: number;
  initialRequestId: number;
  hadTranscriptAtMount: boolean;
  processedRequestId?: number;
  autoSendVoice: boolean;
  canSend: boolean;
}): boolean {
  return (
    Boolean(params.transcript.trim()) &&
    (!params.hadTranscriptAtMount || params.requestId !== params.initialRequestId) &&
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

/** How a learner answer reached Eva, as the message meta reads it; unknown for answers stored before it was kept. */
export function inputSourceLabel(source: InputSource | undefined): string | undefined {
  switch (source) {
    case 'voice':
      return 'spoken';
    case 'text':
      return 'typed';
    case 'edited':
      return 'edited';
    default:
      return undefined;
  }
}
