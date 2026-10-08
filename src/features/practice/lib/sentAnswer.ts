/** The answer just sent from a capture, kept to tie follow-up work (memory usage review) to it. */
export type SentAnswer = {
  sessionId: number;
  sequence: number;
  originalTranscript: string;
  requestId: number;
};
