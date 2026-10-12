import { describe, expect, test } from 'bun:test';
import {
  appendDelta,
  finishReply,
  START_OF_REPLY,
  startReplyLog,
  undeliveredEvents,
} from './index';

describe('reply log', () => {
  test('delivers each delta once, in order', () => {
    const log = appendDelta(appendDelta(startReplyLog(1), 1, 'Hello '), 1, 'there.');

    const [cursor, events] = undeliveredEvents(START_OF_REPLY, log);
    const [, later] = undeliveredEvents(cursor, log);

    expect(events).toEqual([
      { _tag: 'Delta', text: 'Hello ' },
      { _tag: 'Delta', text: 'there.' },
    ]);
    expect(later).toEqual([]);
  });

  test('delivers the final text once, after the deltas', () => {
    const log = finishReply(appendDelta(startReplyLog(1), 1, 'Hi.'), 1, 'Hi.');

    const [cursor, events] = undeliveredEvents(START_OF_REPLY, log);
    const [, later] = undeliveredEvents(cursor, log);

    expect(events.map((event) => event._tag)).toEqual(['Delta', 'Final']);
    expect(later).toEqual([]);
  });

  test('ignores writes from a replaced stream', () => {
    const log = startReplyLog(2);

    expect(appendDelta(log, 1, 'stale')).toBe(log);
    expect(finishReply(log, 1, 'stale')).toBe(log);
  });

  test('ignores writes after the reply is finished', () => {
    const finished = finishReply(startReplyLog(1), 1, 'Done.');

    expect(appendDelta(finished, 1, 'late')).toBe(finished);
    expect(finishReply(finished, 1, 'again')).toBe(finished);
  });

  test('delivers deltas that arrived since the last read', () => {
    const first = appendDelta(startReplyLog(1), 1, 'One. ');
    const [cursor] = undeliveredEvents(START_OF_REPLY, first);
    const second = appendDelta(first, 1, 'Two.');

    const [, events] = undeliveredEvents(cursor, second);

    expect(events).toEqual([{ _tag: 'Delta', text: 'Two.' }]);
  });
});
