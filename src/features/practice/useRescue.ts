import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { keyTarget } from '@/components/keyTarget';
import type { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import { isRescueResponse, type RescueKind, type RescueResponse } from '@/lib/rescueTypes';
import { isProviderError } from '@/lib/types';

type Capture = Pick<ReturnType<typeof useSpeechCapture>, 'rescueTranscript' | 'holdForRescue'>;

type Identity = {
  capture: Capture;
  isRecording: boolean;
  recordingId: number;
  sessionId: number;
  phase: string;
  sequence: number;
  question: string;
};

export type RescueState =
  | { tag: 'closed' }
  | { tag: 'loading'; kind: RescueKind; description: string }
  | { tag: 'answer'; kind: RescueKind; description: string; response: RescueResponse }
  | { tag: 'missing-word'; description: string }
  | { tag: 'selected'; kind: 'missing_word'; term: string }
  | { tag: 'error'; kind: RescueKind; description: string; message: string };

function errorMessage(cause: unknown): string {
  if (isProviderError(cause)) return cause.message;
  return cause instanceof Error
    ? cause.message
    : 'Rescue help is unavailable. Keep speaking and try again.';
}

async function prepareResponse(
  kind: RescueKind,
  description: string,
  expected: Identity,
  isCurrent: () => boolean,
): Promise<RescueResponse | null> {
  const partialTranscript =
    kind === 'missing_word'
      ? ''
      : await expected.capture.rescueTranscript(
          expected.recordingId,
          expected.sessionId,
          expected.sequence,
        );
  if (!isCurrent()) return null;
  const result: unknown = await invoke<unknown>('rescue_answer', {
    session_id: expected.sessionId,
    sequence: expected.sequence,
    request: {
      kind,
      question: expected.question,
      partial_transcript: partialTranscript,
      description: description.trim(),
    },
  });
  if (!isCurrent()) return null;
  if (isRescueResponse(result, kind)) return result;
  throw new Error('Rescue help could not be checked. Keep speaking and retry.');
}

export function useRescue(identity: Identity) {
  const [state, setState] = useState<RescueState>({ tag: 'closed' });
  const latest = useRef(identity);
  latest.current = identity;
  const latestState = useRef(state);
  latestState.current = state;
  const openRef = useRef<() => void>(() => {});
  const generation = useRef(0);
  const inFlight = useRef(false);
  const heldRecording = useRef<number | null>(null);

  function matches(expected: Identity): boolean {
    const current = latest.current;
    return (
      current.isRecording &&
      current.recordingId === expected.recordingId &&
      current.sessionId === expected.sessionId &&
      current.phase === expected.phase &&
      current.sequence === expected.sequence &&
      current.question === expected.question
    );
  }

  function release(recordingId: number) {
    if (heldRecording.current !== recordingId) return;
    heldRecording.current = null;
    latest.current.capture.holdForRescue(recordingId, false);
  }

  function close() {
    generation.current += 1;
    inFlight.current = false;
    const recordingId = heldRecording.current;
    if (recordingId !== null) release(recordingId);
    setState({ tag: 'closed' });
  }

  async function request(kind: RescueKind, description: string, expected: Identity) {
    if (inFlight.current || !matches(expected)) return;
    const requestGeneration = ++generation.current;
    inFlight.current = true;
    expected.capture.holdForRescue(expected.recordingId, true);
    heldRecording.current = expected.recordingId;
    setState({ tag: 'loading', kind, description });
    try {
      const result = await prepareResponse(
        kind,
        description,
        expected,
        () => requestGeneration === generation.current && matches(expected),
      );
      if (result) setState({ tag: 'answer', kind, description, response: result });
    } catch (cause) {
      if (requestGeneration === generation.current && matches(expected)) {
        release(expected.recordingId);
        setState({ tag: 'error', kind, description, message: errorMessage(cause) });
      }
    } finally {
      if (requestGeneration === generation.current) inFlight.current = false;
    }
  }

  function open() {
    if (inFlight.current || state.tag !== 'closed' || !identity.isRecording) return;
    void request('next_step', '', identity);
  }

  openRef.current = open;

  function chooseKind(kind: RescueKind) {
    if (inFlight.current) return;
    if (kind === 'missing_word') {
      const current = latest.current;
      if (!matches(current)) return;
      current.capture.holdForRescue(current.recordingId, true);
      heldRecording.current = current.recordingId;
      setState({ tag: 'missing-word', description: '' });
      return;
    }
    void request(kind, '', latest.current);
  }

  function findWord(description: string) {
    const trimmed = description.trim();
    if (!trimmed || inFlight.current) return;
    void request('missing_word', trimmed, latest.current);
  }

  function retry() {
    if (state.tag !== 'error' || inFlight.current) return;
    void request(state.kind, state.description, latest.current);
  }

  function selectTerm(term: string) {
    if (state.tag === 'answer' && state.kind === 'missing_word')
      setState({ tag: 'selected', kind: 'missing_word', term });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        keyTarget(event.target) !== 'other' ||
        event.key.toLowerCase() !== 's'
      ) {
        return;
      }
      if (latestState.current.tag !== 'closed' || !latest.current.isRecording) return;
      event.preventDefault();
      openRef.current();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
      inFlight.current = false;
      const recordingId = heldRecording.current;
      if (recordingId !== null) {
        heldRecording.current = null;
        latest.current.capture.holdForRescue(recordingId, false);
      }
    },
    [],
  );

  return { state, open, close, chooseKind, findWord, retry, selectTerm };
}
