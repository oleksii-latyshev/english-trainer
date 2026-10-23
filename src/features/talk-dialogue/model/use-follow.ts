import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { afterNewContent, afterScroll, FOLLOWING, newestKey } from '../helpers/follow-scroll';
import { followStateAtom } from './atoms';

export function useFollow(messageCount: number, hasPendingReply: boolean) {
  const state = useAtomValue(followStateAtom);
  const setState = useAtomSet(followStateAtom);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastTopRef = useRef(0);
  const isFollowingRef = useRef(state.isFollowing);
  isFollowingRef.current = state.isFollowing;
  const newest = newestKey(messageCount, hasPendingReply);
  const lastNewestRef = useRef(newest);

  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, []);

  useLayoutEffect(() => {
    setState(FOLLOWING);
    scrollToEnd('instant');
  }, [setState, scrollToEnd]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (isFollowingRef.current) scrollToEnd('instant');
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToEnd]);

  useEffect(() => {
    if (newest === lastNewestRef.current) return;
    lastNewestRef.current = newest;
    setState(afterNewContent);
  }, [newest, setState]);

  function onScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const previousTop = lastTopRef.current;
    lastTopRef.current = viewport.scrollTop;
    setState((current) => afterScroll(current, viewport, previousTop));
  }

  function jumpToNewest() {
    setState(FOLLOWING);
    scrollToEnd('smooth');
  }

  return {
    viewportRef,
    contentRef,
    onScroll,
    jumpToNewest,
    hasUnseen: state.hasUnseen,
  };
}
