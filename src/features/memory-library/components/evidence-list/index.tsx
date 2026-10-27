import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { evidenceKey, memoryUsageEvidenceAtom } from '@/core/learning-memory';
import { Button } from '@/shared/ui/button';
import {
  evidenceDate,
  evidenceSource,
  evidenceTone,
  evidenceTag as tagText,
} from '../../helpers/evidence-copy';
import type { EntryRef } from '../../types';
import { evidenceTag } from './styles';

type Props = { entryRef: EntryRef };

export function EvidenceList({ entryRef }: Props) {
  const atom = memoryUsageEvidenceAtom(evidenceKey(entryRef));
  const result = useAtomValue(atom);
  const retry = useAtomRefresh(atom);

  return (
    <section aria-label="Evidence from conversations" className="flex flex-col gap-2">
      <span className="text-faint text-xs font-semibold">In conversations</span>
      {AsyncResult.match(result, {
        onInitial: () => <p className="text-caption text-faint">Loading evidence…</p>,
        onFailure: () => (
          <div className="text-caption text-warn-text flex items-center gap-3" role="alert">
            <span>Could not load the evidence from conversations.</span>
            <Button onClick={retry} size="sm" tone="secondary">
              Retry
            </Button>
          </div>
        ),
        onSuccess: ({ value }) =>
          value.events.length === 0 ? (
            <p className="text-caption text-faint">
              Nothing yet. Use this wording in a conversation and it shows up here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {value.events.map((event) => (
                <li
                  className="text-caption flex items-baseline gap-2.5 leading-snug"
                  key={event.id}
                >
                  <span className={evidenceTag({ tone: evidenceTone(event) })}>
                    {tagText(event)}
                  </span>
                  {event.exact_excerpt && (
                    <span className="text-quiet-foreground">“{event.exact_excerpt}”</span>
                  )}
                  <span className="text-faint flex-none text-xs">
                    {evidenceSource(event)} · {evidenceDate(event.original_turn_time)}
                  </span>
                </li>
              ))}
            </ul>
          ),
      })}
    </section>
  );
}
