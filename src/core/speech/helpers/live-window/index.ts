export const LIVE_COMMIT_AFTER_MS = 18_000;

export type LiveWindow = {
  readonly committedText: string;
  readonly offsetMs: number;
};

export const EMPTY_LIVE_WINDOW: LiveWindow = { committedText: '', offsetMs: 0 };

export function joinLiveText(head: string, tail: string): string {
  return [head.trim(), tail.trim()].filter((part) => part.length > 0).join(' ');
}

export function advanceLiveWindow(
  window: LiveWindow,
  tailText: string,
  endMs: number,
): { readonly window: LiveWindow; readonly text: string } {
  const text = joinLiveText(window.committedText, tailText);
  if (endMs - window.offsetMs < LIVE_COMMIT_AFTER_MS) return { window, text };
  return { window: { committedText: text, offsetMs: endMs }, text };
}
