export type MistakePracticeProgress = {
  label: string;
  value: number;
  percent: number;
  isComplete: boolean;
};

export function mistakePracticeProgress(
  turnCount: number,
  targetTurns: number,
): MistakePracticeProgress {
  const value = Math.min(turnCount + 1, targetTurns);
  const isComplete = turnCount >= targetTurns;
  return {
    label: isComplete
      ? 'Practice complete'
      : `Question ${value} of ${targetTurns} · About 2 minutes`,
    value: isComplete ? targetTurns : value,
    percent: ((isComplete ? targetTurns : value) / targetTurns) * 100,
    isComplete,
  };
}
