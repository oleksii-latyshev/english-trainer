import { useEffect, useRef, useState } from 'react';
import { effectiveAutoSendDelayMs, useConversationFlow } from '@/lib/conversationFlowPreferences';
import { clearSessionDraft, getSessionDraft, setSessionDraft } from './lib/draftStore';
import {
  canSendPracticeInput,
  type InputSource,
  resolveInputSource,
  shouldAutoSendVoiceTranscript,
} from './lib/inputSource';
import { autoSendAction } from './lib/sendCountdown';
import { useAutoSendCountdown } from './useAutoSendCountdown';

type Options = {
  sessionId?: number;
  currentRequestId: number;
  transcript?: string;
  isRecording: boolean;
  transcribing: boolean;
  busy: boolean;
  disabled: boolean;
  isRetrying: boolean;
  recallActive: boolean;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onStartRecording: () => void;
  onCancelRecording: () => void;
};

/**
 * The answer being composed: the editable draft, the auto-send edit window and sending.
 * Voice transcripts land in the draft; sending is blocked while recording, busy or locked.
 */
export function useAnswerComposer({
  sessionId,
  currentRequestId,
  transcript,
  isRecording,
  transcribing,
  busy,
  disabled,
  isRetrying,
  recallActive,
  onSend,
  onStartRecording,
  onCancelRecording,
}: Options) {
  const [draft, setDraft] = useState('');
  const [lastRecognizedVoice, setLastRecognizedVoice] = useState<string | undefined>(undefined);
  const [isNewVoice, setIsNewVoice] = useState(false);
  const { preferences: flow } = useConversationFlow();
  const [isSending, setIsSending] = useState(false);

  const sendingRef = useRef(false);
  const processedRequestIdRef = useRef<number | undefined>(undefined);
  const sendRef = useRef<(text: string, source: InputSource) => void>(() => {});
  const initialRequestIdRef = useRef(currentRequestId);
  const hadTranscriptAtMountRef = useRef(Boolean(transcript?.trim()));
  const flowRef = useRef(flow);
  const sendStateRef = useRef({
    busy,
    isRecording,
    transcribing,
    disabled,
    isRetrying,
    recallActive,
    isSending,
  });

  flowRef.current = flow;
  sendStateRef.current = {
    busy,
    isRecording,
    transcribing,
    disabled,
    isRetrying,
    recallActive,
    isSending: isSending || sendingRef.current,
  };

  const autoSend = useAutoSendCountdown((text) => sendRef.current(text, 'voice'));

  // Esc abandons listening and the edit window without sending anything.
  const escapeActive = isRecording || autoSend.active;
  useEffect(() => {
    if (!escapeActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      autoSend.cancel();
      if (isRecording) onCancelRecording();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [escapeActive, isRecording, autoSend.cancel, onCancelRecording]);

  // Restore existing in-memory draft if returning to the same active session
  useEffect(() => {
    const existing = getSessionDraft(sessionId);
    if (existing) {
      setDraft(existing.text);
      setLastRecognizedVoice(existing.recognizedText);
      setIsNewVoice(existing.isNewVoice);
    }
  }, [sessionId]);

  // Sync new recognized speech into the editable composer draft
  useEffect(() => {
    if (!transcript?.trim() || processedRequestIdRef.current === currentRequestId) return;

    const existing = getSessionDraft(sessionId);
    const isNewCapture = currentRequestId !== initialRequestIdRef.current;
    const preserveDraft =
      existing !== undefined &&
      (existing.requestId === currentRequestId ||
        (!isNewCapture && existing.requestId === undefined));

    if (!preserveDraft) {
      setDraft(transcript);
      setLastRecognizedVoice(transcript);
      setIsNewVoice(true);
      setSessionDraft(sessionId, {
        text: transcript,
        recognizedText: transcript,
        isNewVoice: true,
        requestId: currentRequestId,
      });
    }

    const shouldAutoSend = shouldAutoSendVoiceTranscript({
      transcript,
      requestId: currentRequestId,
      initialRequestId: initialRequestIdRef.current,
      hadTranscriptAtMount: hadTranscriptAtMountRef.current,
      processedRequestId: processedRequestIdRef.current,
      autoSendVoice: flowRef.current.autoSendVoice,
      canSend: canSendPracticeInput(sendStateRef.current),
    });
    processedRequestIdRef.current = currentRequestId;
    if (!shouldAutoSend) return;
    const delayMs = effectiveAutoSendDelayMs(flowRef.current);
    if (autoSendAction(delayMs) === 'send-now') sendRef.current(transcript, 'voice');
    else autoSend.start(transcript, delayMs);
  }, [currentRequestId, transcript, sessionId, autoSend.start]);

  async function handleTriggerSend(text: string, source: InputSource) {
    if (
      sendingRef.current ||
      !text.trim() ||
      !canSendPracticeInput({
        busy,
        isRecording,
        transcribing,
        disabled,
        isRetrying,
        recallActive,
        isSending,
      })
    )
      return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await onSend(text, source);
      setDraft('');
      setLastRecognizedVoice(undefined);
      setIsNewVoice(false);
      clearSessionDraft(sessionId);
    } catch {
      // Retain exact editable draft on failure for retry
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }

  sendRef.current = (text, source) => {
    void handleTriggerSend(text, source);
  };

  function changeDraft(value: string) {
    autoSend.cancel();
    setDraft(value);
    setSessionDraft(sessionId, {
      text: value,
      recognizedText: lastRecognizedVoice,
      isNewVoice,
      requestId: currentRequestId,
    });
  }

  function sendDraft() {
    autoSend.cancel();
    const source = resolveInputSource({ draft, recognizedText: lastRecognizedVoice, isNewVoice });
    void handleTriggerSend(draft, source);
  }

  function startRecording() {
    autoSend.cancel();
    onStartRecording();
  }

  return {
    draft,
    isNewVoice,
    isSending,
    autoSend: { isActive: autoSend.active, label: autoSend.label },
    changeDraft,
    sendDraft,
    startRecording,
  };
}
