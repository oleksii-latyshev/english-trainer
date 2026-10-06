import { Channel } from '@tauri-apps/api/core';

export type ReplyStreamEvent = { kind: 'delta'; text: string };

export function isReplyStreamEvent(value: unknown): value is ReplyStreamEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'delta' &&
    'text' in value &&
    typeof value.text === 'string'
  );
}

/** Channel passed to commands that stream reply text; unreadable events are dropped. */
export function createReplyChannel(onDelta: (text: string) => void): Channel<unknown> {
  const channel = new Channel<unknown>();
  channel.onmessage = (event) => {
    if (isReplyStreamEvent(event)) onDelta(event.text);
  };
  return channel;
}
