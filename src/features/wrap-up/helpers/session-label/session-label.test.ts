import { describe, expect, it } from 'bun:test';
import { aFinishedSession } from '../../tests/builders';
import { sessionLabel } from './index';

describe('sessionLabel', () => {
  it('names the topic, mode, stage and length', () => {
    expect(sessionLabel(aFinishedSession())).toBe(
      'Work & technology · Speak · Speaking · 10 min 24 s',
    );
    expect(
      sessionLabel(
        aFinishedSession({ practice_mode: 'write_then_speak', practice_phase: 'speaking_review' }),
      ),
    ).toBe('Work & technology · Write, then speak · Review speaking · 10 min 24 s');
    expect(
      sessionLabel(aFinishedSession({ practice_mode: 'text_chat', practice_phase: 'writing' })),
    ).toContain('Text chat · Writing');
  });

  it('labels a drill by its purpose', () => {
    expect(
      sessionLabel(aFinishedSession({ is_mistake_practice: true, duration_ms: 240_000 })),
    ).toBe('Usual mistakes practice · 4 min');
  });
});
