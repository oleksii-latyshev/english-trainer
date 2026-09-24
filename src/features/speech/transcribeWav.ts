import { invoke } from '@tauri-apps/api/core';
import { isTranscript } from '@/lib/types';

export async function transcribeWav(wav: Blob): Promise<{ text: string; sttMs: number }> {
  const audioBytes = new Uint8Array(await wav.arrayBuffer());
  const startedAt = performance.now();
  const result = await invoke<unknown>('transcribe_audio', audioBytes);
  if (!isTranscript(result))
    throw new Error('The transcription response had an unexpected format.');
  return { text: result.text, sttMs: performance.now() - startedAt };
}
