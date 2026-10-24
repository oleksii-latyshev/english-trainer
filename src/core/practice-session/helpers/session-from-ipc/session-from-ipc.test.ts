import { describe, expect, it } from 'bun:test';
import { aPracticeSession } from '../../tests/builders';
import { sessionDetailsFrom } from '.';

describe('written turn count', () => {
  it('counts every turn as written while a text mode is in its writing phase', () => {
    const details = sessionDetailsFrom(
      aPracticeSession({ practice_mode: 'text_chat', practice_phase: 'writing', turn_count: 3 }),
      0,
    );
    expect(details.writtenTurnCount).toBe(3);
  });

  it('reports the saved written count otherwise', () => {
    const details = sessionDetailsFrom(
      aPracticeSession({
        practice_mode: 'write_then_speak',
        practice_phase: 'speaking',
        turn_count: 5,
        written_turn_count: 2,
        spoken_turn_count: 3,
      }),
      0,
    );
    expect(details.writtenTurnCount).toBe(2);
    expect(details.spokenTurnCount).toBe(3);
  });
});
