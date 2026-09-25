import { describe, expect, it } from 'bun:test';
import { sentAnswerMatches } from './sentAnswer';

describe('sent answer pairing', () => {
  it('keeps feedback bound to the sent transcript and capture request', () => {
    const answer = {
      sessionId: 4,
      sequence: 3,
      originalTranscript: 'I worked there.',
      answeredQuestion: 'Where did you work?',
      requestId: 8,
    };

    expect(sentAnswerMatches(answer, 8, 'I worked there.')).toBe(true);
    expect(sentAnswerMatches(answer, 9, 'I worked there.')).toBe(false);
    expect(sentAnswerMatches(answer, 8, 'I work there now.')).toBe(false);
    expect(sentAnswerMatches(null, 8, 'I worked there.')).toBe(false);
  });
});
