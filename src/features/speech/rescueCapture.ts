import { invoke } from '@tauri-apps/api/core';
import type { MutableRefObject } from 'react';
import type { PcmRecorder } from '@/audio/recordPcm';
import type { CaptureState } from './captureView';
import type { TurnWatch } from './listening';

/** A rescue snapshot never consumes the recorder or changes the authoritative final transcript. */
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
      throw new Error('Recording changed. Open Stuck during your current answer.');
    const wav = await recorder.snapshot({ tailMs: 15_000 });
    if (!wav) throw new Error('No audio is ready yet. Say a few words, then try Stuck again.');
    const text: unknown = await invoke<unknown>(
      'transcribe_rescue',
      new Uint8Array(await wav.arrayBuffer()),
      { headers: { 'x-session-id': String(sessionId), 'x-answer-sequence': String(sequence) } },
    );
    if (refs.requestId.current !== recordingId || refs.recorder.current !== recorder)
      throw new Error('Recording changed. Open Stuck during your current answer.');
    if (typeof text !== 'string' || !text.trim())
      throw new Error('No speech was recognized. Keep speaking and try Stuck again.');
    return text.slice(-1500);
  }
  return { holdForRescue: hold, rescueTranscript: transcript };
}
