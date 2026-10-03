export type SessionDraft = {
  text: string;
  recognizedText?: string;
  isNewVoice: boolean;
  requestId?: number;
};

const drafts = new Map<number, SessionDraft>();

export function getSessionDraft(sessionId: number | undefined): SessionDraft | undefined {
  if (sessionId === undefined) return undefined;
  return drafts.get(sessionId);
}

export function setSessionDraft(sessionId: number | undefined, draft: SessionDraft): void {
  if (sessionId === undefined) return;
  // If starting a new session, ensure other session drafts are purged.
  for (const key of drafts.keys()) {
    if (key !== sessionId) {
      drafts.delete(key);
    }
  }
  drafts.set(sessionId, draft);
}

export function clearSessionDraft(sessionId: number | undefined): void {
  if (sessionId === undefined) return;
  drafts.delete(sessionId);
}
