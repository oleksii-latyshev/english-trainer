import { useEffect, useRef, useState } from 'react';
import {
  getCurrentPendingItem,
  isRunFinished,
  mergeRecallResult,
} from '@/features/memory/lib/memoryRecallState';
import {
  type ReviewActionError,
  type ReviewFix,
  reviewIssue,
} from '@/features/memory/lib/reviewIssue';
import type { Attempt } from '@/features/memory/lib/reviewResult';
import { type ReviewPhase, reviewPhase, reviewPrompt } from '@/features/memory/lib/reviewTurn';
import {
  finishMemoryReview,
  skipMemoryReviewItem,
  submitMemoryRecall,
} from '@/features/memory/memoryRecallApi';
import { useReviewKeyboard } from '@/features/memory/useReviewKeyboard';
import { useReviewMaterials } from '@/features/memory/useReviewMaterials';
import { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { MemoryRecallResult, MemoryReviewRun } from '@/lib/memoryRecallTypes';

const MAX_TRANSCRIPT_CHARS = 4000;

export type ReviewStep =
  | { tag: 'answering' }
  | { tag: 'result'; result: MemoryRecallResult; attempt: Attempt }
  | { tag: 'closing' }
  | { tag: 'summary' };

type Pending = 'none' | 'saving' | 'skipping' | 'finishing';

type Options = {
  initialRun: MemoryReviewRun;
  speech: ReturnType<typeof useSystemSpeech>;
  onBackToMemory: () => void;
  onOpenSettings: () => void;
};

const listeningOf = (phase: ReviewPhase): 'no' | 'starting' | 'live' =>
  phase === 'listening' ? 'live' : phase === 'starting' ? 'starting' : 'no';

export function useReviewFlow({ initialRun, speech, onBackToMemory, onOpenSettings }: Options) {
  const capture = useSpeechCapture(speech);
  const [run, setRun] = useState(initialRun);
  const [step, setStep] = useState<ReviewStep>(
    isRunFinished(initialRun.items) ? { tag: 'closing' } : { tag: 'answering' },
  );
  const [pending, setPending] = useState<Pending>('none');
  const [actionError, setActionError] = useState<ReviewActionError | null>(null);
  const materials = useReviewMaterials(initialRun.run_id);
  const frozenPrompt = useRef<ReturnType<typeof reviewPrompt> | null>(null);
  const initialFinishStarted = useRef(false);
  const finishLock = useRef(false);

  const pendingItem = getCurrentPendingItem(run.items);
  const shownItem =
    step.tag === 'result'
      ? (run.items.find((item) => item.position === step.result.position) ?? null)
      : pendingItem;
  const isTryingAgain = step.tag === 'result' && step.attempt.tag === 'recording';
  const isAnswering = step.tag === 'answering' || isTryingAgain;
  const isEvaSpeaking = speech.state.tag === 'speaking' || speech.state.tag === 'starting';
  const phase = reviewPhase({
    captureStatus: capture.view.status,
    isTranscribing: capture.view.transcribing,
    isSaving: pending === 'saving',
  });
  const material = shownItem
    ? materials.materials?.items.find((item) => item.position === shownItem.position)
    : null;
  const generatedPrompt = shownItem
    ? reviewPrompt(
        shownItem.item_type,
        material?.situation ?? shownItem.cue,
        material?.situation !== null && material?.situation !== undefined,
      )
    : null;
  const recordingPhase = phase !== 'prompt';
  const prompt = frozenPrompt.current ?? generatedPrompt;
  const transcript = capture.view.transcript;

  const readPosition = step.tag === 'answering' ? (pendingItem?.position ?? null) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only a new item should be read, not every render.
  useEffect(() => {
    if (readPosition === null || !prompt || recordingPhase) return;
    speech.play(prompt.spoken);
    return () => speech.stop();
  }, [readPosition, prompt?.spoken, recordingPhase]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Runs once, for the run that was opened.
  useEffect(() => {
    if (isRunFinished(initialRun.items) && !initialFinishStarted.current) {
      initialFinishStarted.current = true;
      void finish();
    }
  }, []);

  const latestTranscriptHandler = useRef((_text: string) => {});
  latestTranscriptHandler.current = handleTranscript;
  useEffect(() => {
    if (transcript) latestTranscriptHandler.current(transcript);
  }, [transcript]);

  useReviewKeyboard({
    canStart: isAnswering && phase === 'prompt' && pending === 'none',
    listening: listeningOf(phase),
    isEvaSpeaking,
    onStart: () => startAnswerRecording(),
    onStop: () => void capture.stopRecording(),
    onCancel: capture.cancelRecording,
    onStopEva: speech.stop,
  });

  function handleTranscript(text: string) {
    if (step.tag === 'answering') void save(text);
    if (step.tag === 'result' && step.attempt.tag === 'recording') {
      setStep({ ...step, attempt: { tag: 'tried', transcript: text } });
      capture.reset();
    }
  }

  function startAnswerRecording() {
    if (shownItem && !frozenPrompt.current) frozenPrompt.current = generatedPrompt;
    speech.stop();
    void capture.startRecording();
  }

  async function save(text: string) {
    if (!pendingItem || pending !== 'none') return;
    if ([...text].length > MAX_TRANSCRIPT_CHARS) {
      setActionError('too-long');
      return;
    }
    setPending('saving');
    setActionError(null);
    try {
      const result = await submitMemoryRecall(
        run.run_id,
        pendingItem.item_type,
        pendingItem.item_id,
        text,
      );
      setRun(mergeRecallResult(run, result));
      capture.reset();
      void materials.refresh();
      setStep({ tag: 'result', result, attempt: { tag: 'saved' } });
    } catch {
      setActionError('save');
    } finally {
      setPending('none');
    }
  }

  async function finishRun(runId: number) {
    await finishMemoryReview(runId);
    setStep({ tag: 'summary' });
  }
  async function skip() {
    if (!pendingItem || pending !== 'none') return;
    capture.cancelRecording();
    capture.reset();
    frozenPrompt.current = null;
    speech.stop();
    setPending('skipping');
    setActionError(null);
    try {
      const updated = await skipMemoryReviewItem(
        run.run_id,
        pendingItem.item_type,
        pendingItem.item_id,
      );
      setRun(updated);
      if (isRunFinished(updated.items)) await finishRun(updated.run_id);
    } catch {
      setActionError('skip');
    } finally {
      setPending('none');
    }
  }
  async function finish() {
    if (pending !== 'none' || finishLock.current) return;
    finishLock.current = true;
    setPending('finishing');
    setActionError(null);
    try {
      await finishRun(run.run_id);
    } catch {
      setActionError('finish');
    } finally {
      finishLock.current = false;
      setPending('none');
    }
  }
  async function end() {
    capture.cancelRecording();
    speech.stop();
    if (pending !== 'none') return;
    setPending('finishing');
    setActionError(null);
    try {
      await finishMemoryReview(run.run_id);
      onBackToMemory();
    } catch {
      setActionError('finish');
      setPending('none');
    }
  }
  function fix(kind: ReviewFix) {
    switch (kind) {
      case 'transcribe-again':
        void capture.transcribeRecording();
        return;
      case 'record-again':
        setActionError(null);
        capture.reset();
        return;
      case 'open-settings':
        onOpenSettings();
        return;
      case 'save-again':
        if (transcript) void save(transcript);
        return;
      case 'skip-again':
        void skip();
        return;
      case 'finish-again':
        void finish();
        return;
    }
  }
  function practiceAnswer() {
    speech.stop();
    if (!frozenPrompt.current) frozenPrompt.current = generatedPrompt;
    setStep((current) =>
      current.tag === 'result' ? { ...current, attempt: { tag: 'recording' } } : current,
    );
    void capture.startRecording();
  }
  async function showPhrase() {
    if (shownItem) await materials.reveal(shownItem.position);
  }

  return {
    run,
    step,
    phase,
    prompt,
    shownItem,
    isAnswering,
    isTryingAgain,
    isEvaSpeaking,
    isBusy: pending !== 'none',
    isEnding: pending === 'finishing',
    level: capture.view.level,
    liveText: capture.view.liveText,
    issue: reviewIssue({
      actionError,
      transcriptionFailure: capture.view.transcriptionFailure,
      captureError: capture.view.error,
    }),
    material,
    preparation: materials.materials?.preparation ?? null,
    materialError: materials.error,
    materialBusy: materials.busy,
    retryMaterials: materials.retry,
    revealPhrase: showPhrase,
    practiceAnswer,
    playExample: (text: string) => speech.play(text),
    next: () => {
      capture.reset();
      frozenPrompt.current = null;
      if (isRunFinished(run.items)) void finish();
      else setStep({ tag: 'answering' });
    },
    tryAgain: practiceAnswer,
    pressMic: () => {
      if (phase === 'listening') void capture.stopRecording();
      else startAnswerRecording();
    },
    // "Skip" while answering an item; "Cancel" while trying again after the saved result.
    pressSecondary: () => {
      if (step.tag !== 'result') {
        void skip();
        return;
      }
      capture.cancelRecording();
      capture.reset();
      setStep({ ...step, attempt: { tag: 'saved' } });
    },
    replay: () => {
      if (prompt) speech.play(prompt.spoken);
    },
    end: () => void end(),
    fix,
  };
}
