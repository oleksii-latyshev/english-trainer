import { useCallback, useState } from 'react';

// savedTurnCount is the turn count at which the saved history contains this reply.
type StreamingReply = { sessionId: number; text: string; savedTurnCount: number };

export function useStreamingReply(sessionId: number | undefined, savedTurnCount: number) {
  const [reply, setReply] = useState<StreamingReply | null>(null);

  const isUnsaved =
    reply !== null && reply.sessionId === sessionId && savedTurnCount < reply.savedTurnCount;

  const begin = useCallback((next: { sessionId: number; savedTurnCount: number }) => {
    setReply({ ...next, text: '' });
  }, []);
  const append = useCallback(
    (id: number, text: string) =>
      setReply((current) =>
        current?.sessionId === id ? { ...current, text: current.text + text } : current,
      ),
    [],
  );
  const clear = useCallback(() => setReply(null), []);

  return { pendingReply: isUnsaved ? reply.text : undefined, begin, append, clear };
}
