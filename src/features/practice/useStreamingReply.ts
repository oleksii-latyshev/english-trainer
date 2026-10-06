import { useState } from 'react';

// savedTurnCount is the turn count at which the saved history contains this reply;
// coach replies fill an existing turn, so they are cleared explicitly instead.
type StreamingReply = { sessionId: number; text: string; savedTurnCount?: number };

export function useStreamingReply(sessionId: number | undefined, savedTurnCount: number) {
  const [reply, setReply] = useState<StreamingReply | null>(null);

  const isUnsaved =
    reply !== null &&
    reply.sessionId === sessionId &&
    (reply.savedTurnCount === undefined || savedTurnCount < reply.savedTurnCount);

  return {
    pendingReply: isUnsaved ? reply.text : undefined,
    begin: (next: { sessionId: number; savedTurnCount?: number }) =>
      setReply({ ...next, text: '' }),
    append: (id: number, text: string) =>
      setReply((current) =>
        current?.sessionId === id ? { ...current, text: current.text + text } : current,
      ),
    clear: () => setReply(null),
  };
}
