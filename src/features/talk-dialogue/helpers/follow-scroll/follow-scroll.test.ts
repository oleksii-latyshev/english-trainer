import { describe, expect, it } from 'bun:test';
import { afterNewContent, afterScroll, FOLLOWING, isAtEnd, newestKey, type ScrollMetrics } from '.';

const viewport = { clientHeight: 400, scrollHeight: 1000 };
const metricsAt = (scrollTop: number): ScrollMetrics => ({ ...viewport, scrollTop });

describe('follow scroll', () => {
  it('counts the last few pixels as the end', () => {
    expect(isAtEnd(metricsAt(600))).toBe(true);
    expect(isAtEnd(metricsAt(580))).toBe(true);
    expect(isAtEnd(metricsAt(500))).toBe(false);
  });

  it('pauses following when the learner scrolls up', () => {
    const next = afterScroll(FOLLOWING, metricsAt(300), 600);
    expect(next).toEqual({ isFollowing: false, hasUnseen: false });
  });

  it('keeps following while the view moves down and content grows', () => {
    expect(afterScroll(FOLLOWING, metricsAt(450), 400)).toEqual(FOLLOWING);
  });

  it('resumes and clears the new message marker at the end', () => {
    const paused = { isFollowing: false, hasUnseen: true };
    expect(afterScroll(paused, metricsAt(600), 300)).toEqual(FOLLOWING);
  });

  it('stays paused when the learner scrolls down but not to the end', () => {
    const paused = { isFollowing: false, hasUnseen: true };
    expect(afterScroll(paused, metricsAt(400), 300)).toEqual(paused);
  });

  it('marks a new message only while paused', () => {
    expect(afterNewContent(FOLLOWING)).toEqual(FOLLOWING);
    expect(afterNewContent({ isFollowing: false, hasUnseen: false })).toEqual({
      isFollowing: false,
      hasUnseen: true,
    });
  });

  it('counts the streaming reply as the newest message', () => {
    expect(newestKey(3, false)).toBe(3);
    expect(newestKey(3, true)).toBe(4);
  });
});
