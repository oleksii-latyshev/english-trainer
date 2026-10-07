// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  autoSendAction,
  countdownLabel,
  countdownRemainingMs,
  isCountdownDue,
  isCountdownEdited,
  startSendCountdown,
} from './sendCountdown';

describe('send countdown', () => {
  it('counts down to a deadline and becomes due exactly then', () => {
    const countdown = startSendCountdown('hello', 1000, 2000);
    expect(countdownRemainingMs(countdown, 1000)).toBe(2000);
    expect(isCountdownDue(countdown, 2999)).toBe(false);
    expect(isCountdownDue(countdown, 3000)).toBe(true);
    expect(countdownRemainingMs(countdown, 9000)).toBe(0);
  });

  it('is cancelled by any edit of the transcript', () => {
    const countdown = startSendCountdown('hello world', 0, 2000);
    expect(isCountdownEdited(countdown, 'hello world')).toBe(false);
    expect(isCountdownEdited(countdown, 'hello world.')).toBe(true);
    expect(isCountdownEdited(countdown, '')).toBe(true);
  });

  it('labels the remaining whole seconds, never below one', () => {
    expect(countdownLabel(2000)).toBe('Sending in 2 s — edit to stop');
    expect(countdownLabel(1001)).toBe('Sending in 2 s — edit to stop');
    expect(countdownLabel(10)).toBe('Sending in 1 s — edit to stop');
  });

  it('sends immediately for a zero delay and waits otherwise', () => {
    expect(autoSendAction(0)).toBe('send-now');
    expect(autoSendAction(2000)).toBe('countdown');
  });
});
