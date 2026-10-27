import { useAtomValue } from '@effect/atom-react';
import { isAudioStageAtom, liveTextAtom } from '../../model/view-atoms';

export function LiveTranscript() {
  const text = useAtomValue(liveTextAtom);
  const isAudioStage = useAtomValue(isAudioStageAtom);
  if (!isAudioStage || text === '') return null;
  return (
    <article aria-label="Live transcript" className="flex w-4/5 flex-col items-end gap-2 self-end">
      <div className="border-accent-line bg-surface text-body text-live-text leading-copy rounded-2xl rounded-tr-md border border-dashed px-4.5 py-3.5 wrap-anywhere">
        {text}
        <span
          aria-hidden="true"
          className="bg-accent ml-0.5 inline-block h-4 w-0.5 translate-y-0.75 animate-pulse motion-reduce:animate-none"
        />
      </div>
      <div className="text-caption text-faint pr-1">Live transcript</div>
    </article>
  );
}
