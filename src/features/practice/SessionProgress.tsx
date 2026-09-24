import type { SessionDetails } from './lib/practiceState';

type Props = { session: SessionDetails };

export function SessionProgress({ session }: Props) {
  const { turnCount, targetTurns } = session;
  const hasReachedGoal = turnCount >= targetTurns;
  return (
    <div className="mb-5 rounded-xl border border-teal-700/40 bg-teal-950/20 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-teal-100">Daily practice</p>
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
      <p className="mt-2 mb-0 text-xs leading-5 text-slate-400">
        {hasReachedGoal
          ? 'Goal reached. Finish when you are ready, or keep the conversation going.'
          : 'Aim for a detailed answer each turn. Eight answers can fill about ten minutes.'}
      </p>
    </div>
  );
}
