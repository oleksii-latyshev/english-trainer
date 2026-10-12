import { Channel } from '@tauri-apps/api/core';
import { Option, Schema } from 'effect';

export function openChannel<A>(
  schema: Schema.Decoder<A>,
  onMessage: (message: A) => void,
): Channel<unknown> {
  const decode = Schema.decodeUnknownOption(schema);
  const channel = new Channel<unknown>();
  channel.onmessage = (message) => {
    const decoded = decode(message);
    if (Option.isSome(decoded)) onMessage(decoded.value);
  };
  return channel;
}
