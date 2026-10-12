import { Context, Effect, Layer, type Scope, type Stream, SubscriptionRef } from 'effect';
import type { ActualAudioInput, AudioFrame, TurnEvent } from '../audio';
import {
  type MicrophoneError,
  microphoneDisconnected,
  microphoneFailureOf,
  microphoneUnsupported,
} from '../errors';
import { buildAudioConstraints } from '../helpers/audio-constraints';
import { actualEchoCancellationEnabled, describeInput } from '../helpers/microphone-input';
import { type Capture, type CaptureOptions, makeCaptureEngine } from './capture-engine';
import type { TurnOptions } from './turn-stream';
import { meterLevels, speechOnsets, turnEvents } from './turn-stream';
import { resampleForWhisper } from './whisper-resampler';

export type MicrophoneOpenOptions = {
  readonly deviceId?: string;
  readonly echoCancellation?: boolean;
};

export type MicrophoneSession = {
  readonly input: ActualAudioInput;
  readonly frames: Stream.Stream<AudioFrame>;
  readonly levels: Stream.Stream<number>;
  readonly level: Effect.Effect<number>;
  readonly noiseFloor: Effect.Effect<number>;
  readonly isWarm: Effect.Effect<boolean>;
  readonly warmed: Effect.Effect<void, MicrophoneError>;
  readonly lost: Effect.Effect<never, MicrophoneError>;
  readonly echoCancellationEnabled: Effect.Effect<boolean>;
  readonly capture: (
    options?: CaptureOptions,
  ) => Effect.Effect<Capture, MicrophoneError, Scope.Scope>;
  readonly turns: (options: TurnOptions) => Stream.Stream<TurnEvent>;
  readonly speechOnsets: (options: {
    readonly isEnabled: Effect.Effect<boolean>;
  }) => Stream.Stream<void>;
};

type MicrophoneShape = {
  readonly open: (
    options?: MicrophoneOpenOptions,
  ) => Effect.Effect<MicrophoneSession, MicrophoneError, Scope.Scope>;
  readonly lastInput: SubscriptionRef.SubscriptionRef<ActualAudioInput | null>;
};

const WORKLET_NAME = 'mono-pcm-recorder';

const WORKLET_SOURCE = `
class MonoPcmProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const mono = new Float32Array(input[0].length);
      for (const channel of input) {
        for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / input.length;
      }
      this.port.postMessage(mono, [mono.buffer]);
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor('${WORKLET_NAME}', MonoPcmProcessor);
`;

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(window.AudioWorkletNode)
  );
}

function stopTracks(stream: MediaStream) {
  return Effect.sync(() => {
    for (const track of stream.getTracks()) {
      track.onended = null;
      track.stop();
    }
  });
}

function acquireStream(constraints: MediaStreamConstraints) {
  return Effect.acquireRelease(
    Effect.tryPromise({
      try: () => navigator.mediaDevices.getUserMedia(constraints),
      catch: microphoneFailureOf,
    }),
    stopTracks,
  );
}

function acquireContext() {
  return Effect.acquireRelease(
    Effect.try({ try: () => new AudioContext(), catch: microphoneFailureOf }),
    (context) => Effect.promise(() => context.close()).pipe(Effect.ignore),
  );
}

function acquireModuleUrl() {
  return Effect.acquireRelease(
    Effect.sync(() => URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }))),
    (url) => Effect.sync(() => URL.revokeObjectURL(url)),
  );
}

function acquireGraph(context: AudioContext, media: MediaStream) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const source = context.createMediaStreamSource(media);
      const processor = new AudioWorkletNode(context, WORKLET_NAME);
      const sink = context.createGain();
      sink.gain.value = 0;
      return { source, processor, sink };
    }),
    ({ source, processor, sink }) =>
      Effect.sync(() => {
        processor.port.onmessage = null;
        processor.onprocessorerror = null;
        processor.disconnect();
        source.disconnect();
        sink.disconnect();
      }),
  );
}

function openSession(
  lastInput: SubscriptionRef.SubscriptionRef<ActualAudioInput | null>,
  options: MicrophoneOpenOptions,
): Effect.Effect<MicrophoneSession, MicrophoneError, Scope.Scope> {
  return Effect.gen(function* () {
    if (!isSupported()) return yield* microphoneUnsupported;
    const constraints = buildAudioConstraints(options.deviceId, options.echoCancellation ?? false);
    const media = yield* acquireStream(constraints);
    const input = describeInput(media);
    yield* SubscriptionRef.set(lastInput, input);
    const context = yield* acquireContext();
    const engine = yield* makeCaptureEngine({
      sampleRateHz: context.sampleRate,
      resample: resampleForWhisper,
    });
    const moduleUrl = yield* acquireModuleUrl();
    yield* Effect.tryPromise({
      try: () => context.audioWorklet.addModule(moduleUrl),
      catch: microphoneFailureOf,
    });
    const { source, processor, sink } = yield* acquireGraph(context, media);
    function lose() {
      engine.fail(microphoneDisconnected);
    }
    processor.onprocessorerror = lose;
    for (const track of media.getAudioTracks()) track.onended = lose;
    processor.port.onmessage = (event: MessageEvent<Float32Array>) => engine.ingest(event.data);
    yield* engine.armStartupTimeout;
    source.connect(processor).connect(sink).connect(context.destination);
    yield* Effect.tryPromise({ try: () => context.resume(), catch: microphoneFailureOf });
    yield* Effect.addFinalizer(() => stopTracks(media));

    return {
      input,
      frames: engine.frames,
      levels: meterLevels({ frames: engine.frames, noiseFloor: engine.noiseFloor }),
      level: engine.level,
      noiseFloor: engine.noiseFloor,
      isWarm: engine.isWarm,
      warmed: engine.warmed,
      lost: engine.lost,
      echoCancellationEnabled: Effect.sync(() => {
        const track = media.getAudioTracks()[0];
        const settings = typeof track?.getSettings === 'function' ? track.getSettings() : undefined;
        return actualEchoCancellationEnabled(settings);
      }),
      capture: engine.capture,
      turns: (turnOptions) => turnEvents(engine, turnOptions),
      speechOnsets: (onsetOptions) => speechOnsets(engine, onsetOptions),
    };
  });
}

export class Microphone extends Context.Service<Microphone, MicrophoneShape>()(
  'core/audio/Microphone',
) {
  static readonly layer = Layer.effect(
    Microphone,
    Effect.gen(function* () {
      const lastInput = yield* SubscriptionRef.make<ActualAudioInput | null>(null);
      return {
        open: (options = {}) => openSession(lastInput, options),
        lastInput,
      };
    }),
  );
}
