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

function coachGuidance(turnCount: number, targetTurns: number): string {
  if (turnCount >= targetTurns)
    return 'Four answer Coach goal reached. Finish now or continue practicing.';
  if (turnCount > 0)
    return `Coach: ${targetTurns - turnCount} answers remain. Review and Continue are optional.`;
  return 'Answer the Coach prompt, review focused feedback, then continue when you are ready.';
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
  const isCoach = session.mode === 'coach';
  const currentStep = isCoach
    ? Math.min(turnCount + 1, 3)
    : practiceStep(turnCount, targetTurns, recallActive);
  const labels = isCoach
    ? ['Answer', 'Review feedback', 'Continue or finish']
    : stepLabels(session, recallActive, recallCompletedCount);
  const guidance = recallActive
    ? 'Speak the phrase from the cue, then save the local transcript. Leave recall to finish practice.'
    : isCoach
      ? coachGuidance(turnCount, targetTurns)
      : practiceGuidance(turnCount, targetTurns, hasRetried);
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-4 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-purple-300">
          Step {currentStep} of {isCoach ? 3 : 4} · {isCoach ? 'Coach Practice' : 'Daily Practice'}
        </p>
        <span className="text-xs font-medium text-zinc-400">
          {turnCount} {turnCount === 1 ? 'answer' : 'answers'} · goal {targetTurns}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-300"
          style={{ width: `${Math.min(100, (turnCount / targetTurns) * 100)}%` }}
        />
      </div>
      <p className="m-0 text-xs leading-relaxed text-zinc-400">{guidance}</p>
      <div className="flex flex-wrap gap-2 pt-1 text-[0.72rem]">
        {labels.map((label) => (
          <span
            className={`rounded-md px-2 py-0.5 border ${
              label.includes('✓')
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-medium'
                : label.includes('now')
                  ? 'border-purple-500/30 bg-purple-500/10 text-purple-200 font-semibold'
                  : 'border-white/5 bg-white/5 text-zinc-500'
            }`}
            key={label}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
