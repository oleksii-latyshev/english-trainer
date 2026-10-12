import { spawn } from 'node:child_process';

export type Raw = { rate: number; samples: Float32Array };

export async function openRaw(directory: string) {
  const child = spawn(`${directory}/speech`, [`${directory}/model`], {
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  let buffered = Buffer.alloc(0);
  const waiting: Array<() => void> = [];
  child.stdout.on('data', (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    for (const wake of waiting.splice(0)) wake();
  });
  async function read(bytes: number): Promise<Buffer> {
    while (buffered.length < bytes) await new Promise<void>((resolve) => waiting.push(resolve));
    const out = buffered.subarray(0, bytes);
    buffered = buffered.subarray(bytes);
    return Buffer.from(out);
  }
  await read(4);
  return {
    synth: async (text: string, voice = 0, speed = 1): Promise<Raw> => {
      const body = Buffer.from(text);
      const header = Buffer.alloc(12);
      header.writeUInt32LE(body.length, 0);
      header.writeUInt32LE(voice, 4);
      header.writeFloatLE(speed, 8);
      child.stdin.write(Buffer.concat([header, body]));
      const size = (await read(4)).readUInt32LE(0);
      const wav = await read(size);
      const pcm = new Int16Array(
        wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length),
      );
      return { rate: wav.readUInt32LE(24), samples: Float32Array.from(pcm, (v) => v / 32768) };
    },
    close: () => child.kill(),
  };
}
