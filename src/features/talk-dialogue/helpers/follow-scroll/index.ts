export type ScrollMetrics = {
  readonly scrollTop: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
};

export type FollowState = {
  readonly isFollowing: boolean;
  readonly hasUnseen: boolean;
};

export const FOLLOWING: FollowState = { isFollowing: true, hasUnseen: false };

const END_THRESHOLD_PX = 24;

export function isAtEnd(metrics: ScrollMetrics): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= END_THRESHOLD_PX;
}

export function afterScroll(
  state: FollowState,
  metrics: ScrollMetrics,
  previousTop: number,
): FollowState {
  if (isAtEnd(metrics)) return FOLLOWING;
  const isMovingUp = metrics.scrollTop < previousTop;
  if (state.isFollowing && !isMovingUp) return state;
  return { isFollowing: false, hasUnseen: state.hasUnseen };
}

export function afterNewContent(state: FollowState): FollowState {
  return state.isFollowing ? state : { isFollowing: false, hasUnseen: true };
}

export function newestKey(messageCount: number, hasPendingReply: boolean): number {
  return messageCount + (hasPendingReply ? 1 : 0);
}
