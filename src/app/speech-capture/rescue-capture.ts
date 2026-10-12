import type { MutableRefObject } from 'react';
import type { PcmRecorder } from '@/app/microphone';
import { rescueTranscript } from '@/core/speech';
import type { CaptureState } from './capture-view';
import type { TurnWatch } from './listening';
import { settleSpeech } from './settle-speech';

const RECORDING_CHANGED = 'Recording changed. Open Stuck during your current answer.';
const RESCUE_TAIL_MS = 15_000;

export function createRescueCapture(refs: {
  recorder: MutableRefObject<PcmRecorder | null>;
  state: MutableRefObject<CaptureState>;
  requestId: MutableRefObject<number>;
  turnWatch: MutableRefObject<TurnWatch | null>;
  held: MutableRefObject<boolean>;
}) {
  function hold(recordingId: number, isHeld: boolean) {
    if (refs.requestId.current !== recordingId || refs.state.current.tag !== 'recording') return;
    refs.held.current = isHeld;
    refs.turnWatch.current?.setHold(isHeld || refs.state.current.held);
  }
  async function transcript(recordingId: number, sessionId: number, sequence: number) {
    const recorder = refs.recorder.current;
    if (
      !recorder ||
      refs.requestId.current !== recordingId ||
      refs.state.current.tag !== 'recording'
    )
      throw new Error(RECORDING_CHANGED);
    const text = await settleSpeech(
      rescueTranscript(recorder.capture.snapshot({ tailMs: RESCUE_TAIL_MS }), {
        sessionId,
        sequence,
      }),
    );
    if (refs.requestId.current !== recordingId || refs.recorder.current !== recorder)
      throw new Error(RECORDING_CHANGED);
    return text;
  }
  return { holdForRescue: hold, rescueTranscript: transcript };
}
