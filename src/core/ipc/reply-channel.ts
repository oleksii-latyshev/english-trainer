import { Channel } from '@tauri-apps/api/core';
import { Option, Schema } from 'effect';
import { ReplyStreamEventSchema } from './schemas/conversation-turn';

const decodeReplyEvent = Schema.decodeUnknownOption(ReplyStreamEventSchema);

export function openReplyChannel(onDelta: (text: string) => void): Channel<unknown> {
  const channel = new Channel<unknown>();
  channel.onmessage = (message) => {
    const event = decodeReplyEvent(message);
    if (Option.isSome(event)) onDelta(event.value.text);
  };
  return channel;
}
