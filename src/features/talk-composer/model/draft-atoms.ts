import { Atom } from 'effect/reactivity';
import { sessionDetailsAtom } from '@/core/practice-session';

export type Draft = {
  readonly text: string;
  readonly recognizedText: string | undefined;
  readonly isNewVoice: boolean;
};

type ScopedDraft = { readonly scope: string | null; readonly draft: Draft };

export const EMPTY_DRAFT: Draft = { text: '', recognizedText: undefined, isNewVoice: false };

export const draftScopeAtom = Atom.make((get) => {
  const session = get(sessionDetailsAtom);
  return session === undefined
    ? null
    : `${session.sessionId}:${session.practiceMode}:${session.practicePhase}`;
});

const storedDraftAtom = Atom.keepAlive(Atom.make<ScopedDraft>({ scope: null, draft: EMPTY_DRAFT }));

export const draftAtom = Atom.writable(
  (get): Draft => {
    const stored = get(storedDraftAtom);
    return stored.scope === get(draftScopeAtom) ? stored.draft : EMPTY_DRAFT;
  },
  (context, draft: Draft) => {
    context.set(storedDraftAtom, { scope: context.get(draftScopeAtom), draft });
  },
);

export const isSendingAtom = Atom.keepAlive(Atom.make(false));

export const countdownLabelAtom = Atom.keepAlive(Atom.make<string | null>(null));

export const processedRequestAtom = Atom.keepAlive(Atom.make<number | undefined>(undefined));

export const holdingSpaceAtom = Atom.keepAlive(Atom.make(false));

export const abandonedStartAtom = Atom.keepAlive(Atom.make(false));
