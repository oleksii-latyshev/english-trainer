import { expect, it } from 'bun:test';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { IpcError } from '@/core/ipc';
import { libraryOf } from './index';

const VIEW = { mistakes: [], phrase_cards: [], due_count: 0 };

it('is loading until Rust answers', () => {
  expect(libraryOf(AsyncResult.initial())).toEqual({ tag: 'loading' });
});

it('is ready with the entries once Rust answers', () => {
  expect(libraryOf(AsyncResult.success(VIEW))).toEqual({ tag: 'ready', entries: [] });
});

it('is unavailable when the first read fails', () => {
  const failure = new IpcError({ code: 'database_error', message: 'No.' });
  expect(libraryOf(AsyncResult.fail(failure)).tag).toBe('unavailable');
});

it('keeps what is on screen when a later read fails', () => {
  const failure = new IpcError({ code: 'database_error', message: 'No.' });
  const stale = AsyncResult.fail(failure, {
    previousSuccess: Option.some(AsyncResult.success(VIEW)),
  });
  expect(libraryOf(stale)).toEqual({ tag: 'ready', entries: [] });
});
