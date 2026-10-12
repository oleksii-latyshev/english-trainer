import type { ReplyEvent } from '../../types';

export type ReplyLog = {
  readonly streamId: number;
  readonly deltas: readonly string[];
  readonly final: string | null;
};

export type ReplyCursor = {
  readonly deltas: number;
  readonly isFinalDelivered: boolean;
};

export const EMPTY_REPLY_LOG: ReplyLog = { streamId: 0, deltas: [], final: null };
export const START_OF_REPLY: ReplyCursor = { deltas: 0, isFinalDelivered: false };

export function startReplyLog(streamId: number): ReplyLog {
  return { streamId, deltas: [], final: null };
}

export function appendDelta(log: ReplyLog, streamId: number, delta: string): ReplyLog {
  if (log.streamId !== streamId || log.final !== null) return log;
  return { ...log, deltas: [...log.deltas, delta] };
}

export function finishReply(log: ReplyLog, streamId: number, finalText: string): ReplyLog {
  if (log.streamId !== streamId || log.final !== null) return log;
  return { ...log, final: finalText };
}

export function undeliveredEvents(
  cursor: ReplyCursor,
  log: ReplyLog,
): readonly [ReplyCursor, ReadonlyArray<ReplyEvent>] {
  const deltas = log.deltas
    .slice(cursor.deltas)
    .map((text): ReplyEvent => ({ _tag: 'Delta', text }));
  const finalEvent: ReplyEvent[] =
    log.final !== null && !cursor.isFinalDelivered ? [{ _tag: 'Final', text: log.final }] : [];
  return [
    { deltas: log.deltas.length, isFinalDelivered: cursor.isFinalDelivered || log.final !== null },
    [...deltas, ...finalEvent],
  ];
}
