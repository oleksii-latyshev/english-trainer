import { Button } from '@heroui/react';
import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import { useConversationFlow } from '@/lib/conversationFlowPreferences';
import { ComposerFooter } from './ComposerFooter';
import { ListeningStatus } from './ListeningStatus';
import type { ComposerVoice } from './lib/composerVoice';
import { clearSessionDraft, getSessionDraft, setSessionDraft } from './lib/draftStore';
import {
  canSendPracticeInput,
  type InputSource,
  resolveInputSource,
  shouldAutoSendVoiceTranscript,
} from './lib/inputSource';
import { autoSendAction } from './lib/sendCountdown';
import { ScaffoldingPanel } from './ScaffoldingPanel';
import { useAutoSendCountdown } from './useAutoSendCountdown';

type Props = {
  sessionId?: number;
  currentRequestId: number;
  answerSequence?: number;
  question?: string;
  transcript?: string;
  isRecording: boolean;
  transcribing: boolean;
  busy: boolean;
  disabled?: boolean;
  disabledReason?: string;
  errorMessage?: string;
  isRetrying?: boolean;
  recallActive?: boolean;
  voice: ComposerVoice;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSend: (text: string, source: InputSource) => Promise<void>;
};

export function PracticeChatComposer({
  sessionId,
  currentRequestId,
  answerSequence,
  question,
  transcript,
  isRecording,
  transcribing,
  busy,
  disabled = false,
  disabledReason,
  errorMessage,
  isRetrying = false,
  recallActive = false,
  voice,
  onStartRecording,
  onStopRecording,
  onSend,
}: Props) {
  const { actualInput } = usePreferredMicrophone();
  const [draft, setDraft] = useState('');
  const [lastRecognizedVoice, setLastRecognizedVoice] = useState<string | undefined>(undefined);
  const [isNewVoice, setIsNewVoice] = useState(false);
  const { preferences: flow, update: updateFlow } = useConversationFlow();
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
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      autoSend.cancel();
      if (isRecording) voice.onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [escapeActive, isRecording, autoSend.cancel, voice.onCancel]);

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
    const delayMs = flowRef.current.autoSendDelayMs;
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

  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    autoSend.cancel();
    setDraft(value);
    setSessionDraft(sessionId, {
      text: value,
      recognizedText: lastRecognizedVoice,
      isNewVoice,
      requestId: currentRequestId,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSendClick();
    }
  }

  function handleSendClick() {
    autoSend.cancel();
    const source = resolveInputSource({ draft, recognizedText: lastRecognizedVoice, isNewVoice });
    void handleTriggerSend(draft, source);
  }

  const isComposerBlocked = disabled || isRetrying || recallActive;

  return (
    <section className="practice-composer-bar" aria-label="Chat composer">
      <div className="practice-composer-inner">
        {question && !recallActive && !isRetrying && (
          <details className="composer-scaffolding-details">
            <summary className="composer-scaffolding-summary">
              <span className="text-xs font-semibold text-purple-300">
                💡 Answer help &amp; flow
              </span>
            </summary>
            <div className="pt-2">
              <ScaffoldingPanel
                key={`${sessionId}:${answerSequence}:${question}`}
                question={question}
                sessionId={sessionId}
                sequence={answerSequence}
                disabled={busy || isSending || isRecording || transcribing || isComposerBlocked}
              />
            </div>
          </details>
        )}

        {isComposerBlocked && disabledReason && (
          <div className="composer-blocked-banner" role="status">
            <p className="m-0 text-xs text-zinc-300">{disabledReason}</p>
          </div>
        )}

        <div className="composer-input-row">
          <textarea
            aria-label="Your answer to Eva"
            className="composer-textarea"
            disabled={isComposerBlocked || busy || isSending}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isComposerBlocked
                ? 'Review action in progress above…'
                : 'Type your answer or record your voice… (Cmd+Enter to send)'
            }
            rows={2}
            value={draft}
          />

          <div className="composer-actions">
            {isRecording ? (
              <Button
                aria-label="Stop recording"
                className="primary-action !bg-rose-500 !text-white hover:!bg-rose-600"
                onPress={onStopRecording}
              >
                ■ Stop
              </Button>
            ) : (
              <Button
                aria-label="Start recording"
                className="secondary-action"
                isDisabled={busy || transcribing || isComposerBlocked}
                onPress={() => {
                  autoSend.cancel();
                  onStartRecording();
                }}
              >
                🎤 Record
              </Button>
            )}

            <Button
              aria-label="Send answer"
              className="primary-action"
              isDisabled={
                !draft.trim() ||
                isSending ||
                busy ||
                isRecording ||
                transcribing ||
                isComposerBlocked
              }
              onPress={handleSendClick}
            >
              {isSending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>

        <ListeningStatus
          disabled={isComposerBlocked || busy || transcribing}
          handsFree={flow.handsFree}
          isRecording={isRecording}
          voice={voice}
        />
        {autoSend.active && !isSending && (
          <p className="m-0 flex items-center gap-3 text-xs text-purple-300" role="status">
            <span>{autoSend.label}</span>
            <Button
              className="secondary-action text-xs"
              onPress={() => {
                autoSend.cancel();
                handleSendClick();
              }}
              size="sm"
            >
              Send now
            </Button>
          </p>
        )}
        {isNewVoice && !isSending && (
          <p className="m-0 text-xs text-zinc-400">
            Check the recognized text, especially names and technical words, before sending.
          </p>
        )}
        <ComposerFooter
          actualInputLabel={actualInput?.label}
          blocked={isComposerBlocked}
          errorMessage={errorMessage}
          flow={flow}
          onFlowChange={updateFlow}
          transcribing={transcribing}
        />
      </div>
    </section>
  );
}
