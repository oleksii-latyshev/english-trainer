import { useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { practiceBlockedReason, practiceSummary } from '../../helpers/practice-copy';
import { practiceTargetsAtom } from '../../model/atoms';

type Props = {
  isAudioBusy: boolean;
  isSessionOpen: boolean;
  isStarting: boolean;
  error: string;
  onStart: () => void;
};

export function MistakePracticeCard({
  isAudioBusy,
  isSessionOpen,
  isStarting,
  error,
  onStart,
}: Props) {
  const targets = useAtomValue(practiceTargetsAtom);
  const practicableCount = targets.tag === 'ready' ? targets.practicableCount : 0;
  const samples = targets.tag === 'ready' ? targets.samples : [];
  const reason = practiceBlockedReason({
    isLibraryError: targets.tag === 'unavailable',
    isLibraryReady: targets.tag === 'ready',
    isSessionOpen,
    isAudioBusy,
    practicableCount,
  });

  return (
    <GlassPanel
      aria-labelledby="mistake-practice-title"
      className="flex flex-col gap-1.5 px-4.5 py-4"
    >
      <h2 className="text-body font-bold" id="mistake-practice-title">
        Practice my usual mistakes
      </h2>
      <p className="text-caption text-muted leading-copy m-0">
        {practiceSummary(samples, practicableCount)}
      </p>
      {reason && <p className="text-faint m-0 text-xs">{reason}</p>}
      {isStarting && (
        <p aria-live="polite" className="text-faint m-0 text-xs">
          Preparing five questions…
        </p>
      )}
      {error && (
        <p className="text-warn-text m-0 text-xs" role="alert">
          {error}
        </p>
      )}
      <Button
        className="mt-auto self-start"
        disabled={reason !== '' || isStarting}
        onClick={onStart}
        pending={isStarting}
        size="sm"
        tone="secondary"
      >
        {isStarting ? 'Preparing…' : 'Practice · 2 min'}
      </Button>
    </GlassPanel>
  );
}
