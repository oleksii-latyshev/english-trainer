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
      <span className="text-faint text-pip font-bold tracking-wide uppercase">Live transcript</span>
      <p className="rounded-card border-accent-line bg-surface text-body text-live-text leading-copy m-0 rounded-br-md border border-dashed px-4 py-3">
        {text}
        <span
          aria-hidden="true"
          className="bg-accent ml-0.75 inline-block h-4 w-0.5 translate-y-0.75"
        />
      </p>
    </article>
  );
}
