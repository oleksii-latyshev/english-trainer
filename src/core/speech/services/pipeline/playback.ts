import { Effect, Ref, Stream } from 'effect';
import { FIRST_AUDIO_START_TIMEOUT_MS } from '../../helpers/speech-timing';
import type { SpeechEngineChoice } from '../../types';
import { SystemVoiceError } from '../system-voice-service';
import { announceFirstAudio, type Pipeline, type PlayItem } from './pipeline';

function fallbackVoiceUri(engine: SpeechEngineChoice): string | null {
  return engine.kind === 'natural' ? engine.fallbackVoiceURI : engine.voiceURI;
}

function untilNaturalAudioIdle(pipeline: Pipeline): Effect.Effect<void> {
  return pipeline.naturalOutput?.session.untilIdle ?? Effect.void;
}

function speakUtterance(
  pipeline: Pipeline,
  utterance: string,
): Effect.Effect<void, SystemVoiceError> {
  const { request, system } = pipeline;
  return untilNaturalAudioIdle(pipeline).pipe(
    Effect.andThen(
      system
        .speak({
          text: utterance,
          voiceURI: fallbackVoiceUri(request.engine),
          rate: request.rate,
        })
        .pipe(Stream.runForEach(() => announceFirstAudio(pipeline))),
    ),
  );
}

function awaitClipStart(
  pipeline: Pipeline,
  item: Extract<PlayItem, { _tag: 'Clip' }>,
): Effect.Effect<void, SystemVoiceError> {
  const output = pipeline.naturalOutput;
  if (output === null) return Effect.void;
  return Ref.get(pipeline.hasPlayed).pipe(
    Effect.flatMap((hasPlayed) =>
      hasPlayed
        ? Effect.void
        : output.session.untilStarted(item.handle).pipe(
            Effect.timeout(FIRST_AUDIO_START_TIMEOUT_MS),
            Effect.mapError(() => new SystemVoiceError({ reason: 'playback-failed' })),
          ),
    ),
    Effect.andThen(announceFirstAudio(pipeline)),
  );
}

function play(pipeline: Pipeline, item: PlayItem): Effect.Effect<void, SystemVoiceError> {
  return item._tag === 'Utterance'
    ? speakUtterance(pipeline, item.text)
    : awaitClipStart(pipeline, item);
}

function finishSpeech(pipeline: Pipeline): Effect.Effect<void> {
  const { callbacks } = pipeline.request;
  return Effect.gen(function* () {
    yield* untilNaturalAudioIdle(pipeline);
    const hasPlayed = yield* Ref.get(pipeline.hasPlayed);
    yield* Effect.sync(() => {
      if (hasPlayed) {
        callbacks.onState({ tag: 'idle' });
        callbacks.onEnd();
        return;
      }
      callbacks.onState({ tag: 'error', reason: 'empty-text' });
      callbacks.onError();
    });
  });
}

function reportFailure(pipeline: Pipeline, failure: SystemVoiceError): Effect.Effect<void> {
  const { callbacks } = pipeline.request;
  return Effect.sync(() => {
    callbacks.onState(
      failure.reason === 'unsupported'
        ? { tag: 'unavailable', reason: 'unsupported' }
        : { tag: 'error', reason: 'playback-failed' },
    );
    callbacks.onError();
  });
}

export function playAll(pipeline: Pipeline): Effect.Effect<void> {
  return Stream.fromQueue(pipeline.plays).pipe(
    Stream.runForEach((item) => play(pipeline, item)),
    Effect.andThen(finishSpeech(pipeline)),
    Effect.catch((failure) => reportFailure(pipeline, failure)),
  );
}
