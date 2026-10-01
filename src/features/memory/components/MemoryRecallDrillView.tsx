import { Button, Card, Chip } from '@heroui/react';
import { MemoryRecallCapture } from '@/features/memory/components/MemoryRecallCapture';
import type { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import type {
  MemoryRecallResult,
  MemoryReviewItem,
  MemoryReviewRun,
  SavedMemoryReviewItem,
} from '@/lib/memoryRecallTypes';

type Props = {
  run: MemoryReviewRun;
  capture: ReturnType<typeof useSpeechCapture>;
  latestResult: MemoryRecallResult | null;
  currentPending: MemoryReviewItem | null;
  completedCount: number;
  allCompleted: boolean;
  isSaving: boolean;
  isFinishing: boolean;
  isCaptureBusy: boolean;
  saveError: string | null;
  actionError: string | null;
  onEndReview: () => void;
  onSaveRecall: () => void;
  onNext: () => void;
};

export function MemoryRecallDrillView(props: Props) {
  if (props.latestResult) return <RecallResultView {...props} result={props.latestResult} />;
  if (props.allCompleted) return <RecallCompleteView {...props} />;
  if (!props.currentPending) return null;
  return <RecallActiveView {...props} item={props.currentPending} />;
}

function RecallResultView({
  result,
  run,
  isCaptureBusy,
  currentPending,
  onNext,
}: Props & { result: MemoryRecallResult }) {
  return (
    <Card className="border border-white/[0.08] bg-[#161619] p-6 shadow-xl" variant="secondary">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <Chip color={result.wording_observed ? 'success' : 'warning'} size="sm" variant="soft">
          {result.wording_observed ? 'Target wording appeared' : 'Target wording not detected'}
        </Chip>
        <span className="text-xs text-zinc-400">
          Item {result.position} of {run.items.length}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase">Recall cue</span>
          <p className="mt-1 text-sm text-zinc-300">“{result.cue}”</p>
        </div>
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase">Target wording</span>
          <p className="mt-1 text-base font-semibold text-emerald-300">“{result.target}”</p>
        </div>
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase">Transcript</span>
          <p className="mt-1 text-sm text-zinc-200">“{result.transcript}”</p>
        </div>
        <p className="m-0 rounded-xl border border-white/[0.06] bg-black/30 p-3 text-xs text-zinc-400">
          Next review in {result.interval_days} {result.interval_days === 1 ? 'day' : 'days'}. This
          check looks for target wording in the transcript; it does not assess pronunciation,
          meaning, or conversational mastery.
        </p>
      </div>
      <div className="mt-6 flex justify-end">
        <Button isDisabled={isCaptureBusy} onPress={onNext} size="sm" variant="primary">
          {currentPending ? 'Next item' : 'View summary'}
        </Button>
      </div>
    </Card>
  );
}

function RecallCompleteView({ run, isFinishing, isCaptureBusy, actionError, onEndReview }: Props) {
  return (
    <Card className="border border-white/[0.08] bg-[#161619] p-6 shadow-xl" variant="secondary">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <h2 className="text-lg font-bold text-zinc-100">Voice review complete</h2>
        <Chip color="success" size="sm" variant="soft">
          {run.items.length} items saved
        </Chip>
      </div>
      <SavedResults run={run} />
      {actionError && (
        <p role="alert" className="text-sm text-rose-200">
          {actionError}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <Button
          isDisabled={isFinishing || isCaptureBusy}
          onPress={onEndReview}
          size="sm"
          variant="primary"
        >
          {isFinishing ? 'Finishing…' : 'Finish review'}
        </Button>
      </div>
    </Card>
  );
}

function RecallActiveView({
  run,
  item,
  capture,
  completedCount,
  isSaving,
  isFinishing,
  isCaptureBusy,
  saveError,
  actionError,
  onEndReview,
  onSaveRecall,
}: Props & { item: MemoryReviewItem }) {
  return (
    <Card className="border border-white/[0.08] bg-[#161619] p-6 shadow-xl" variant="secondary">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <Chip color="accent" size="sm" variant="soft">
            {item.item_type === 'mistake' ? 'MISTAKE RECALL' : 'PHRASE RECALL'}
          </Chip>
          <span className="text-xs text-zinc-400">
            Item {item.position} of {run.items.length}
          </span>
        </div>
        <Button
          className="border border-white/10 text-xs text-zinc-400"
          isDisabled={isFinishing || isSaving || isCaptureBusy}
          onPress={onEndReview}
          size="sm"
          variant="secondary"
        >
          End review
        </Button>
      </div>
      {completedCount > 0 && <SavedResults run={run} compact />}
      <div className="my-6 rounded-xl border border-purple-500/20 bg-purple-950/10 p-5 text-center">
        <span className="text-xs font-semibold tracking-wider text-purple-400 uppercase">
          Say the target wording for:
        </span>
        <blockquote className="mt-2 mb-0 text-base font-medium text-zinc-100">
          “{item.cue}”
        </blockquote>
      </div>
      {actionError && (
        <div
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-sm text-rose-200"
          role="alert"
        >
          <p className="m-0">{actionError}</p>
          <Button
            className="mt-2"
            isDisabled={isCaptureBusy}
            onPress={onEndReview}
            size="sm"
            variant="secondary"
          >
            Retry finish
          </Button>
        </div>
      )}
      {saveError && (
        <div
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-sm text-rose-200"
          role="alert"
        >
          <p className="m-0">{saveError}</p>
          <Button
            isDisabled={isSaving || isCaptureBusy}
            onPress={onSaveRecall}
            size="sm"
            variant="secondary"
          >
            Retry save
          </Button>
        </div>
      )}
      <MemoryRecallCapture
        capture={capture}
        isCaptureBusy={isCaptureBusy}
        isFinishing={isFinishing}
        isSaving={isSaving}
        onSaveRecall={onSaveRecall}
      />
    </Card>
  );
}

function SavedResults({ run, compact = false }: { run: MemoryReviewRun; compact?: boolean }) {
  const saved = run.items.filter(
    (item): item is SavedMemoryReviewItem => item.saved_response !== null,
  );
  if (!saved.length) return null;
  return (
    <section
      className={compact ? 'mt-4 grid gap-2' : 'mt-4 grid gap-3'}
      aria-label="Saved review results"
    >
      {saved.map((item) => (
        <div
          key={`saved-${item.position}`}
          className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Item {item.position}</span>
            <Chip color={item.wording_observed ? 'success' : 'warning'} size="sm" variant="soft">
              {item.wording_observed ? 'Wording appeared' : 'Not detected'}
            </Chip>
          </div>
          <p className="mt-1 mb-0 text-sm font-medium text-zinc-200">Target: “{item.target}”</p>
          <p className="mt-0.5 mb-0 text-xs text-zinc-400">Transcript: “{item.transcript}”</p>
        </div>
      ))}
    </section>
  );
}
