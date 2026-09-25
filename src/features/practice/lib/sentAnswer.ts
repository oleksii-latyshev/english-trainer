export type SentAnswer = {
  sessionId: number;
  sequence: number;
  originalTranscript: string;
  answeredQuestion: string;
  requestId: number;
};

export function sentAnswerMatches(
  answer: SentAnswer | null,
  requestId: number,
  transcript: string | undefined,
): answer is SentAnswer {
  return (
    answer !== null && answer.requestId === requestId && answer.originalTranscript === transcript
  );
}
