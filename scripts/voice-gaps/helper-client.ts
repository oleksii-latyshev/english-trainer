import { type ChildProcessByStdio, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

const READY_TAG = 'TTS1';
const WAVE_HEADER_BYTES = 44;
const PADDING_WINDOW_MS = 10;
const AUDIBLE_THRESHOLD = 32768 * 0.003;

export type TrimSettings = {
  readonly threshold: number;
  readonly beforeMs: number;
  readonly afterMs: number;
};

export type Clip = {
  readonly synthMs: number;
  readonly audioMs: number;
  readonly leadSilenceMs: number;
  readonly tailSilenceMs: number;
};

type Reader = { readonly read: (bytes: number) => Promise<Buffer> };

function reader(stream: Readable): Reader {
  let buffered = Buffer.alloc(0);
  const waiting: Array<() => void> = [];
  stream.on('data', (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    for (const wake of waiting.splice(0)) wake();
  });
  stream.on('end', () => {
    for (const wake of waiting.splice(0)) wake();
  });
  return {
    read: async (bytes) => {
      while (buffered.length < bytes) {
        await new Promise<void>((resolve) => waiting.push(resolve));
        if (stream.readableEnded && buffered.length < bytes) throw new Error('Helper exited');
      }
      const out = buffered.subarray(0, bytes);
      buffered = buffered.subarray(bytes);
      return out;
    },
  };
}

function windowMeanSquares(samples: Int16Array, windowSamples: number): number[] {
  const out: number[] = [];
  for (let start = 0; start < samples.length; start += windowSamples) {
    const end = Math.min(samples.length, start + windowSamples);
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += (samples[index] ?? 0) ** 2;
    out.push(sum / (end - start));
  }
  return out;
}

function firstAbove(levels: number[], threshold: number): number {
  return levels.findIndex((level) => level > threshold ** 2);
}

function lastAbove(levels: number[], threshold: number): number {
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    if ((levels[index] ?? 0) > threshold ** 2) return index;
  }
  return -1;
}

function toSamples(wav: Buffer): Int16Array {
  const body = wav.subarray(WAVE_HEADER_BYTES);
  return new Int16Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.length));
}

function trimPadding(samples: Int16Array, rate: number, trim: TrimSettings): Int16Array {
  const window = Math.floor(rate / 100);
  const levels = windowMeanSquares(samples, window);
  const first = firstAbove(levels, 32768 * trim.threshold);
  const last = lastAbove(levels, 32768 * trim.threshold);
  if (first < 0) return samples;
  const start = Math.max(0, first * window - Math.floor((rate * trim.beforeMs) / 1000));
  const end = Math.min(
    samples.length,
    (last + 1) * window + Math.floor((rate * trim.afterMs) / 1000),
  );
  return samples.subarray(start, end);
}

function describe(wav: Buffer, synthMs: number, trim: TrimSettings): Clip {
  const rate = wav.readUInt32LE(24);
  const trimmed = trimPadding(toSamples(wav), rate, trim);
  const window = Math.floor((rate * PADDING_WINDOW_MS) / 1000);
  const levels = windowMeanSquares(trimmed, window);
  const first = firstAbove(levels, AUDIBLE_THRESHOLD);
  const last = lastAbove(levels, AUDIBLE_THRESHOLD);
  return {
    synthMs,
    audioMs: (trimmed.length / rate) * 1000,
    leadSilenceMs: first < 0 ? 0 : first * PADDING_WINDOW_MS,
    tailSilenceMs: last < 0 ? 0 : (levels.length - 1 - last) * PADDING_WINDOW_MS,
  };
}

export type RawClip = {
  readonly synthMs: number;
  readonly measure: (trim: TrimSettings) => Clip;
};

export type Helper = {
  readonly synthesize: (text: string, voiceId: number, speed: number) => Promise<RawClip>;
  readonly close: () => void;
};

export async function openHelper(directory: string): Promise<Helper> {
  const child: ChildProcessByStdio<Writable, Readable, null> = spawn(
    `${directory}/speech`,
    [`${directory}/model`],
    { stdio: ['pipe', 'pipe', 'ignore'] },
  );
  const stdout = reader(child.stdout);
  if ((await stdout.read(4)).toString() !== READY_TAG) throw new Error('Invalid helper protocol');
  return {
    synthesize: async (text, voiceId, speed) => {
      const body = Buffer.from(text);
      const header = Buffer.alloc(12);
      header.writeUInt32LE(body.length, 0);
      header.writeUInt32LE(voiceId, 4);
      header.writeFloatLE(speed, 8);
      const started = performance.now();
      child.stdin.write(Buffer.concat([header, body]));
      const size = (await stdout.read(4)).readUInt32LE(0);
      const wav = Buffer.from(await stdout.read(size));
      const synthMs = performance.now() - started;
      return { synthMs, measure: (trim) => describe(wav, synthMs, trim) };
    },
    close: () => {
      child.kill();
    },
  };
}
