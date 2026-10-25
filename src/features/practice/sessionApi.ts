import { invoke } from '@tauri-apps/api/core';

/** Records that help was opened for the answer to the current question; once per answer is enough. */
export async function recordAnswerHelpUsed(sessionId: number, sequence: number): Promise<void> {
  await invoke<void>('record_answer_help_used', { sessionId, sequence });
}
