// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { createLiveTicker } from './liveTicker';

const wav = new Blob(['x'], { type: 'audio/wav' });

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('live ticker', () => {
  it('does not transcribe before speech is heard', async () => {
    let transcriptions = 0;
    let isSpeaking = false;
    const ticker = createLiveTicker({
      isWanted: () => isSpeaking,
      snapshot: async () => wav,
      transcribe: async () => {
        transcriptions += 1;
        return 'Hi';
      },
      onText: () => {},
    });
    await ticker.tick();
    expect(transcriptions).toBe(0);
    isSpeaking = true;
    await ticker.tick();
    expect(transcriptions).toBe(1);
  });

  it('shows the text of each finished update', async () => {
    const shown: string[] = [];
    const ticker = createLiveTicker({
      isWanted: () => true,
      snapshot: async () => wav,
      transcribe: async () => 'Hello there',
      onText: (text) => shown.push(text),
    });
    await ticker.tick();
    await ticker.tick();
    expect(shown).toEqual(['Hello there', 'Hello there']);
  });

  it('skips a tick while the previous update is still running', async () => {
    const pending = deferred<string | null>();
    let transcriptions = 0;
    const shown: string[] = [];
    const ticker = createLiveTicker({
      isWanted: () => true,
      snapshot: async () => wav,
      transcribe: () => {
        transcriptions += 1;
        return pending.promise;
      },
      onText: (text) => shown.push(text),
    });
    const first = ticker.tick();
    await ticker.tick();
    expect(transcriptions).toBe(1);
    pending.resolve('Hi');
    await first;
    expect(shown).toEqual(['Hi']);
    await ticker.tick();
    expect(transcriptions).toBe(2);
  });

  it('shows nothing after stop, even for an update already running', async () => {
    const pending = deferred<string | null>();
    const shown: string[] = [];
    const ticker = createLiveTicker({
      isWanted: () => true,
      snapshot: async () => wav,
      transcribe: () => pending.promise,
      onText: (text) => shown.push(text),
    });
    const running = ticker.tick();
    ticker.stop();
    pending.resolve('late');
    await running;
    await ticker.tick();
    expect(shown).toEqual([]);
  });

  it('keeps the last text when there is no audio, no text or a failure', async () => {
    const shown: string[] = [];
    let step = 0;
    const ticker = createLiveTicker({
      isWanted: () => true,
      snapshot: async () => (step === 0 ? null : wav),
      transcribe: async () => {
        if (step === 2) throw new Error('server busy');
        return step === 1 ? null : 'unused';
      },
      onText: (text) => shown.push(text),
    });
    for (step = 0; step < 3; step += 1) await ticker.tick();
    expect(shown).toEqual([]);
  });
});
