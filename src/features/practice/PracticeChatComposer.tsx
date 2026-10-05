import { Button } from '@heroui/react';
import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import { clearSessionDraft, getSessionDraft, setSessionDraft } from './lib/draftStore';
import {
  canSendPracticeInput,
  type InputSource,
  resolveInputSource,
  shouldAutoSendVoiceTranscript,
} from './lib/inputSource';
import { ScaffoldingPanel } from './ScaffoldingPanel';

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
  onStartRecording,
  onStopRecording,
  onSend,
}: Props) {
  const { actualInput } = usePreferredMicrophone();
  const [draft, setDraft] = useState('');
  const [lastRecognizedVoice, setLastRecognizedVoice] = useState<string | undefined>(undefined);
  const [isNewVoice, setIsNewVoice] = useState(false);
  const [autoSendVoice, setAutoSendVoice] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const sendingRef = useRef(false);
  const processedRequestIdRef = useRef<number | undefined>(undefined);
  const sendRef = useRef<(text: string, source: InputSource) => void>(() => {});
  const initialRequestIdRef = useRef(currentRequestId);
  const hadTranscriptAtMountRef = useRef(Boolean(transcript?.trim()));
  const autoSendVoiceRef = useRef(autoSendVoice);
  const sendStateRef = useRef({
    busy,
    isRecording,
    transcribing,
    disabled,
    isRetrying,
    recallActive,
    isSending,
  });

  autoSendVoiceRef.current = autoSendVoice;
  sendStateRef.current = {
    busy,
    isRecording,
    transcribing,
    disabled,
    isRetrying,
    recallActive,
    isSending: isSending || sendingRef.current,
  };

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
      autoSendVoice: autoSendVoiceRef.current,
      canSend: canSendPracticeInput(sendStateRef.current),
    });
    processedRequestIdRef.current = currentRequestId;
    if (shouldAutoSend) sendRef.current(transcript, 'voice');
  }, [currentRequestId, transcript, sessionId]);

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
                onPress={onStartRecording}
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

        {isNewVoice && !isSending && (
          <p className="m-0 text-xs text-zinc-400">
            Check the recognized text, especially names and technical words, before sending.
          </p>
        )}
        <div className="composer-footer">
          {actualInput && (
            <span className="text-xs text-zinc-400">Last input: {actualInput.label}</span>
          )}
          <div className="flex items-center gap-3">
            <label className="composer-checkbox-label">
              <input
                aria-label="Send voice answers automatically"
                checked={autoSendVoice}
                disabled={isComposerBlocked}
                onChange={(e) => setAutoSendVoice(e.target.checked)}
                type="checkbox"
              />
              <span>Send voice answers automatically</span>
            </label>
            {transcribing && (
              <span className="text-xs text-purple-300 animate-pulse">Transcribing locally…</span>
            )}
          </div>
          {errorMessage && (
            <p className="error-message m-0 text-xs" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
