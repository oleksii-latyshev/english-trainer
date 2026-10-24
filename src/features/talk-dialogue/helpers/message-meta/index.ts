export function formatReplyTime(replyMs: number | undefined): string | undefined {
  if (replyMs === undefined) return undefined;
  return `${(replyMs / 1000).toFixed(1)} s`;
}

export function formatAnswerDuration(durationMs: number | undefined): string | undefined {
  if (durationMs === undefined) return undefined;
  return `${Math.round(durationMs / 1000)} s`;
}

export function inputSourceLabel(source: string | undefined): string | undefined {
  switch (source) {
    case 'voice':
      return 'spoken';
    case 'text':
      return 'typed';
    case 'edited':
      return 'edited';
    default:
      return undefined;
  }
}
