import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  afterNewContent,
  afterScroll,
  FOLLOWING,
  type FollowState,
  newestKey,
} from '../helpers/follow-scroll';
import { followStateAtom } from './atoms';

export function useFollow(messageCount: number, pendingReply: string | undefined) {
  const state = useAtomValue(followStateAtom);
  const setState = useAtomSet(followStateAtom);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastTopRef = useRef(0);
  const stateRef = useRef<FollowState>(state);
  const newest = newestKey(messageCount, pendingReply);
  const lastNewestRef = useRef(newest);

  const update = useCallback(
    (next: FollowState) => {
      stateRef.current = next;
      setState(next);
    },
    [setState],
  );

  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, []);

  useLayoutEffect(() => {
    update(FOLLOWING);
    scrollToEnd('instant');
  }, [update, scrollToEnd]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (stateRef.current.isFollowing) scrollToEnd('instant');
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToEnd]);

  useEffect(() => {
    if (newest === lastNewestRef.current) return;
    lastNewestRef.current = newest;
    update(afterNewContent(stateRef.current));
  }, [newest, update]);

  function onScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const previousTop = lastTopRef.current;
    lastTopRef.current = viewport.scrollTop;
    update(afterScroll(stateRef.current, viewport, previousTop));
  }

  function jumpToNewest() {
    update(FOLLOWING);
    scrollToEnd('instant');
  }

  return {
    viewportRef,
    contentRef,
    onScroll,
    jumpToNewest,
    hasUnseen: state.hasUnseen,
  };
}
