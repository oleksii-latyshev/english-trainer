import type { LimitNote } from '@/core/ipc';
import { quotaResetText } from '../../helpers/usage-text';

type Props = { note: LimitNote; nowMs: number; showsReset: boolean };

function clockTime(milliseconds: number): string {
  return new Date(milliseconds).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function LimitText({ note, nowMs, showsReset }: Props) {
  return (
    <>
      At {clockTime(note.occurred_at_ms)}: {note.message}
      {showsReset && <> {quotaResetText(note.resets_at_ms, nowMs)}</>}
    </>
  );
}
