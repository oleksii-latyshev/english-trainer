import type { Habit } from '../../types';

function rate(value: number): string {
  return value.toFixed(1);
}

export function habitLine(habit: Habit): string {
  return `${habit.word} ${rate(habit.from_rate)} → ${rate(habit.to_rate)} per 100 words`;
}
