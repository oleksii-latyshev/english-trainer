import { Effect, Queue, Ref, Stream } from 'effect';
import {
  appendSpeechDelta,
  finishSpeechStream,
  splitSentences,
} from '../../helpers/reply-sentences';
import type { ReplyEvent } from '../../types';
import type { Pipeline, TextState } from './pipeline';

export function applyReplyEvent(
  state: TextState,
  event: ReplyEvent,
  splitsIntoSentences: boolean,
): TextState {
  const result =
    event._tag === 'Delta'
      ? appendSpeechDelta(state.stream, event.text)
      : finishSpeechStream(state.stream, event.text);
  return {
    stream: result.state,
    sentences: [
      ...state.sentences,
      ...(splitsIntoSentences ? result.utterances.flatMap(splitSentences) : result.utterances),
    ],
    isFinished: state.isFinished || event._tag === 'Final',
  };
}

export function collectReplies(pipeline: Pipeline): Effect.Effect<void> {
  const splitsIntoSentences = pipeline.request.engine.kind === 'natural';
  return pipeline.request.replies.pipe(
    Stream.runForEach((event) =>
      Ref.update(pipeline.text, (state) => applyReplyEvent(state, event, splitsIntoSentences)).pipe(
        Effect.andThen(Queue.offer(pipeline.wake, undefined)),
      ),
    ),
  );
}

export function takeSentence(pipeline: Pipeline): Effect.Effect<string | undefined> {
  return Ref.modify(pipeline.text, (state): [string | undefined, TextState] => {
    const [head, ...rest] = state.sentences;
    return [head, { ...state, sentences: rest }];
  });
}
