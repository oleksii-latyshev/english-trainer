import type { SessionDetails } from './lib/practiceState';

type Props = { session: SessionDetails; recallActive: boolean; recallCompletedCount: number };

function practiceGuidance(turnCount: number, targetTurns: number, hasRetried: boolean): string {
  const hasReachedGoal = turnCount >= targetTurns;
  let guidance =
    'Warm up: answer the opening question aloud. Your answer is counted after you send the transcript.';
  if (turnCount > 0 && !hasReachedGoal) {
    const remaining = targetTurns - turnCount;
    guidance = `Conversation: ${remaining} ${remaining === 1 ? 'answer' : 'answers'} to the suggested goal. You may finish early.`;
  }
  if (hasReachedGoal) {
    guidance = hasRetried
      ? 'Speaking goal reached and a Try Again attempt saved. Finish whenever you are ready.'
      : 'Speaking goal reached. Review a recent answer and use Try Again if useful, then finish.';
  }
  return guidance;
}

function practiceStep(turnCount: number, targetTurns: number, recallActive: boolean): number {
  if (turnCount === 0) return 1;
  if (turnCount < targetTurns) return 2;
  return recallActive ? 4 : 3;
}

function stepLabels(session: SessionDetails, recallActive: boolean, recallCompletedCount: number) {
  const hasReachedGoal = session.turnCount >= session.targetTurns;
  return [
    `Warm-up ${session.turnCount > 0 ? '✓' : '· now'}`,
    `Conversation ${hasReachedGoal ? '✓' : session.turnCount > 0 ? '· now' : ''}`,
    `Try Again ${session.retryEvidence.length > 0 ? '✓' : hasReachedGoal ? '· optional' : ''}`,
    `Spoken recall ${recallCompletedCount > 0 ? `· ${recallCompletedCount} saved` : recallActive ? '· now' : hasReachedGoal ? '· optional' : ''}`,
  ];
}

export function SessionProgress({ session, recallActive, recallCompletedCount }: Props) {
  const { turnCount, targetTurns } = session;
  const hasRetried = session.retryEvidence.length > 0;
  const currentStep = practiceStep(turnCount, targetTurns, recallActive);
  const labels = stepLabels(session, recallActive, recallCompletedCount);
  const guidance = recallActive
    ? 'Speak the phrase from the cue, then save the local transcript. Leave recall to finish practice.'
    : practiceGuidance(turnCount, targetTurns, hasRetried);
  return (
    <div className="mb-5 rounded-xl border border-teal-700/40 bg-teal-950/20 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-teal-100">
          Step {currentStep} of 4 · Daily practice
        </p>
        <p className="m-0 text-sm text-slate-300">
          {turnCount} {turnCount === 1 ? 'answer' : 'answers'} · goal {targetTurns}
        </p>
      </div>
      <progress
        aria-label="Daily practice answers"
        className="mt-3 h-2 w-full accent-teal-400"
        max={targetTurns}
        value={Math.min(turnCount, targetTurns)}
      />
      <p className="mt-2 mb-0 text-xs leading-5 text-slate-400">{guidance}</p>
      <ol className="mt-3 mb-0 flex flex-wrap gap-x-5 gap-y-1 pl-5 text-xs text-slate-400">
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ol>
    </div>
  );
}
