import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Check } from 'lucide-react';
import type { GeminiKeyStatus } from '@/core/ipc';
import { keySourceLabel } from '../../helpers/key-source-label';
import type { GeminiKeyFailure } from '../../types';

type Props = {
  result: AsyncResult.AsyncResult<GeminiKeyStatus, GeminiKeyFailure>;
};

function SavedKeyLine({ status }: { status: GeminiKeyStatus | null }) {
  if (!status?.configured || status.source === null) return <>No API key saved.</>;
  return (
    <span className="flex items-center gap-1.5">
      <Check aria-hidden="true" className="flex-none text-ok" size={12} strokeWidth={2.4} />
      {keySourceLabel(status.source)}
    </span>
  );
}

function lastReadStatus(failure: AsyncResult.Failure<GeminiKeyStatus, GeminiKeyFailure>) {
  return Option.getOrNull(Option.map(failure.previousSuccess, (success) => success.value));
}

export function KeyStatusLine({ result }: Props) {
  return AsyncResult.match(result, {
    onInitial: () => <>Checking for a saved API key…</>,
    onFailure: (failure) => <SavedKeyLine status={lastReadStatus(failure)} />,
    onSuccess: (success) => <SavedKeyLine status={success.value} />,
  });
}
