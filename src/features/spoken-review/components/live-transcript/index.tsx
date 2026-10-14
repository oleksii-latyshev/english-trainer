import { useAtomValue } from '@effect/atom-react';
import { livePreviewAtom } from '../../model/view-atoms';

export function LiveTranscript() {
  const text = useAtomValue(livePreviewAtom);
  if (text === '') return null;

  return (
    <article
      aria-label="Live transcript"
      className="flex max-w-140 flex-col items-end gap-1 self-end"
    >
      <span className="font-bold text-faint text-pip uppercase tracking-wide">Live transcript</span>
      <p className="m-0 rounded-card rounded-br-md border border-accent-line border-dashed bg-surface px-4 py-3 text-body text-live-text leading-copy">
        {text}
        <span
          aria-hidden="true"
          className="ml-0.75 inline-block h-4 w-0.5 translate-y-0.75 bg-accent"
        />
      </p>
    </article>
  );
}
