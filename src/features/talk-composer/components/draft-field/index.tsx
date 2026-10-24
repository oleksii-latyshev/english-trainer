import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { type KeyboardEvent, useEffect, useState } from 'react';
import { Textarea } from '@/shared/ui/textarea';
import { isDraftFocusedAtom } from '../../model/draft-atoms';

type Props = {
  label: string;
  value: string;
  isDisabled: boolean;
  shouldFocus: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
};

const BLUR_SETTLE_MS = 250;

function focusField(node: HTMLTextAreaElement | null) {
  node?.focus();
}

export function DraftField({ label, value, isDisabled, shouldFocus, onChange, onSend }: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const setDraftFocused = useAtomSet(isDraftFocusedAtom);
  const isSettledFocused = useAtomValue(isDraftFocusedAtom);

  useEffect(() => {
    if (isFocused) {
      setDraftFocused(true);
      return;
    }
    const timer = setTimeout(() => setDraftFocused(false), BLUR_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isFocused, setDraftFocused]);

  useEffect(() => () => setDraftFocused(false), [setDraftFocused]);
  const isCompact = !isSettledFocused && value === '';

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-semibold text-caption text-muted" htmlFor="talk-draft">
        {label}
      </label>
      <Textarea
        disabled={isDisabled}
        id="talk-draft"
        onBlur={() => setIsFocused(false)}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type your answer…"
        rows={isCompact ? 1 : 2}
        ref={shouldFocus ? focusField : undefined}
        value={value}
      />
    </div>
  );
}
