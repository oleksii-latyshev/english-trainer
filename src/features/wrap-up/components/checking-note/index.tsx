import { checkingLine } from '../../helpers/checking-line';
import type { FinishedSession } from '../../types';

type Props = {
  summary: FinishedSession;
};

export function CheckingNote({ summary }: Props) {
  const line = checkingLine(summary.pending_coaching, summary.is_coaching_paused);
  if (line === '') return null;
  return <p className="text-caption text-muted leading-copy m-0">{line}</p>;
}
