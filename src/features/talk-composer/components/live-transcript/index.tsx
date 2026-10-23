import { useAtomValue } from '@effect/atom-react';
import { isAudioStageAtom, liveTextAtom } from '../../model/view-atoms';

export function LiveTranscript() {
  const text = useAtomValue(liveTextAtom);
  const isAudioStage = useAtomValue(isAudioStageAtom);
  if (!isAudioStage || text === '') return null;
  return (
    <article aria-label="Live transcript" className="flex w-4/5 flex-col items-end gap-2 self-end">
      <div className="wrap-anywhere rounded-2xl rounded-tr-md border border-accent-line border-dashed bg-surface px-4.5 py-3.5 text-body text-live-text leading-copy">
        {text}
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.75 animate-pulse bg-accent motion-reduce:animate-none"
        />
      </div>
      <div className="pr-1 text-caption text-faint">Live transcript</div>
    </article>
  );
}
