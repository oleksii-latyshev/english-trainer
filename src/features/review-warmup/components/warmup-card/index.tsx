import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { dueLabel, emptyHint, phraseSource } from '../../helpers/warmup-copy';
import type { WarmupPhrase } from '../../types';

type Props = {
  dueCount: number;
  nextPhrase: WarmupPhrase | undefined;
  isWarmupOffered: boolean;
  warmupFirst: boolean;
  onWarmupFirstChange: (warmupFirst: boolean) => void;
  onReview: () => void;
};

const WARMUP_OPTIONS = [
  { value: 'before', label: 'Before session' },
  { value: 'skip', label: 'Skip today' },
] as const;

function PhraseBlock({ phrase }: { phrase: WarmupPhrase }) {
  const source = phraseSource(phrase);
  return (
    <>
      <div className="font-semibold text-lg leading-snug tracking-tight">“{phrase.phrase}”</div>
      {source && <div className="text-caption text-muted leading-copy">{source}</div>}
    </>
  );
}

export function WarmupCard({
  dueCount,
  nextPhrase,
  isWarmupOffered,
  warmupFirst,
  onWarmupFirstChange,
  onReview,
}: Props) {
  return (
    <GlassPanel aria-label="Phrases to review" className="flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-caption text-faint">Say it again today</h2>
        {dueCount > 0 && (
          <span className="font-bold text-accent-text text-caption">{dueLabel(dueCount)}</span>
        )}
      </div>
      {nextPhrase ? (
        <PhraseBlock phrase={nextPhrase} />
      ) : (
        <>
          <div className="font-semibold text-lg leading-snug tracking-tight">
            Nothing to review today
          </div>
          <div className="text-caption text-muted leading-copy">{emptyHint()}</div>
        </>
      )}
      {isWarmupOffered && (
        <div className="text-caption text-quiet-foreground">
          A 2-minute spoken warm-up before you start
        </div>
      )}
      {(isWarmupOffered || dueCount > 0) && (
        <div className="flex items-center gap-2">
          {isWarmupOffered && (
            <SegmentedControl
              label="Warm-up before the conversation"
              onChange={(choice) => onWarmupFirstChange(choice === 'before')}
              options={WARMUP_OPTIONS}
              size="sm"
              value={warmupFirst ? 'before' : 'skip'}
            />
          )}
          {dueCount > 0 && (
            <Button className="ml-auto" onClick={onReview} size="sm" tone="quiet">
              Review now
            </Button>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
