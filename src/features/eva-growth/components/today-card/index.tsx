import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  type EvaGrowthSnapshot,
  evaGrowthAtom,
  knownGrowthAtom,
  toEvaStage,
} from '@/core/eva-growth';
import { Button } from '@/shared/ui/button';
import { Eva } from '@/shared/ui/eva';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Notice } from '@/shared/ui/notice';
import { ProgressBar } from '@/shared/ui/progress-bar';
import {
  EMPTY_TODAY,
  gainAmount,
  speakingGainLabel,
  stageProgress,
  sunshineGainLabel,
} from '../../helpers/growth-copy';

type Gain = { id: string; amount: string; label: string; tone: string };

function todaysGains(growth: EvaGrowthSnapshot): Gain[] {
  const speaking = growth.today.speaking.map((gain, index) => ({
    id: `speaking-${index}`,
    amount: gainAmount(gain),
    label: speakingGainLabel(gain),
    tone: 'text-accent-text',
  }));
  const sunshine = growth.today.sunshine.map((gain, index) => ({
    id: `sunshine-${index}`,
    amount: gainAmount(gain),
    label: sunshineGainLabel(gain),
    tone: 'text-warn-text',
  }));
  return [...speaking, ...sunshine];
}

export function TodayCard() {
  const growth = useAtomValue(knownGrowthAtom);
  const result = useAtomValue(evaGrowthAtom);
  const retry = useAtomRefresh(evaGrowthAtom);

  return (
    <GlassPanel aria-labelledby="today-heading" className="flex flex-col px-6 py-6">
      <h2 className="font-semibold text-caption text-faint" id="today-heading">
        Today
      </h2>
      {growth !== null && <TodayBody growth={growth} />}
      {growth === null && AsyncResult.isFailure(result) && (
        <Notice className="mt-4 flex items-center gap-3" role="alert" tone="quiet">
          <span className="flex-1">Eva's growth could not be loaded.</span>
          <Button onClick={retry} size="sm" tone="secondary">
            Retry
          </Button>
        </Notice>
      )}
      {growth === null && !AsyncResult.isFailure(result) && (
        <Notice className="mt-4" role="status" tone="quiet">
          Loading Eva's growth…
        </Notice>
      )}
    </GlassPanel>
  );
}

function TodayBody({ growth }: { growth: EvaGrowthSnapshot }) {
  const progress = stageProgress(growth);
  const gains = todaysGains(growth);
  return (
    <>
      <div className="flex h-57 items-end justify-center">
        <Eva
          label={growth.napping ? 'Eva is napping' : 'Eva'}
          mood={growth.napping ? 'asleep' : 'happy'}
          size={190}
          stage={toEvaStage(growth.stage)}
        />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="font-bold text-xl tracking-tight">{progress.stageName}</span>
        <span className="text-muted tabular-nums">{progress.summary}</span>
      </div>
      <ProgressBar
        className="mt-2.5"
        label="Progress in this stage"
        max={progress.max}
        size="md"
        value={progress.value}
      />
      {gains.length === 0 ? (
        <p className="mt-5 mb-0 text-muted">{EMPTY_TODAY}</p>
      ) : (
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {gains.map((gain) => (
            <li className="flex items-center gap-2.5" key={gain.id}>
              <span className={`w-11 font-bold ${gain.tone}`}>{gain.amount}</span>
              <span className="text-eva-text">{gain.label}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
