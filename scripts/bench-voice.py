#!/usr/bin/env python3
"""Compare denoising steps of the bundled speech helper: timing, peaks, and WAV samples to listen to."""
import argparse
import array
import os
from pathlib import Path
import select
import struct
import subprocess
import time

SENTENCES = [
    'She sells sea shells by the seashore, so Sam chose six fresh sandwiches.',
    'Please, check the cheap chairs, then touch the stitches on the shirt.',
    'The strict teacher taught the students to stretch, practise and spell.',
    'It is just a short, sharp, sudden stop at the station this Thursday.',
    'Sixty-six thick sheets of paper were stacked inside the chest.',
    'Such a cheerful, special situation surely deserves a sincere thanks.',
    'Hi! What have you been up to today? I would love to hear about it.',
    'I usually start by breaking the problem down into smaller steps, then I check each one with a colleague, and after that I write a short summary of what we decided so that everybody can see the plan.',
]
FIRST_PHRASE = 'That sounds like a really useful approach to me.'


def read_exact(pipe, size, timeout=120):
    end = time.monotonic() + timeout
    output = bytearray()
    while len(output) < size:
        left = end - time.monotonic()
        if left <= 0 or not select.select([pipe], [], [], left)[0]:
            raise TimeoutError('Local speech helper missed its deadline')
        chunk = os.read(pipe.fileno(), size - len(output))
        if not chunk:
            raise RuntimeError('Local speech helper exited')
        output.extend(chunk)
    return bytes(output)


def synthesise(process, text, voice):
    data = text.encode()
    started = time.monotonic()
    process.stdin.write(struct.pack('<IIf', len(data), voice, 1) + data)
    process.stdin.flush()
    size, = struct.unpack('<I', read_exact(process.stdout, 4))
    wav = read_exact(process.stdout, size)
    return wav, (time.monotonic() - started) * 1000


def measure(wav):
    rate, = struct.unpack('<I', wav[24:28])
    samples = array.array('h')
    samples.frombytes(wav[44:])
    peak = max(max(samples), -min(samples))
    clipped = sum(1 for s in samples if s >= 32767 or s <= -32768)
    return len(samples) / rate, peak, clipped


def run(directory, steps, voices, out, rounds):
    env = dict(os.environ, ENGLISH_TRAINER_VOICE_STEPS=str(steps))
    process = subprocess.Popen([str(directory / 'speech'), str(directory / 'model')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
    rows = []
    try:
        if read_exact(process.stdout, 4) != b'TTS1':
            raise RuntimeError('Invalid local speech protocol')
        synthesise(process, 'Hi!', 0)
        folder = out / str(steps)
        folder.mkdir(parents=True, exist_ok=True)
        for voice in voices:
            for index, text in enumerate(SENTENCES + [FIRST_PHRASE], 1):
                times = []
                for _ in range(rounds):
                    wav, ms = synthesise(process, text, voice)
                    times.append(ms)
                (folder / f'voice{voice}-{index}.wav').write_bytes(wav)
                seconds, peak, clipped = measure(wav)
                rows.append(dict(steps=steps, voice=voice, n=index, chars=len(text), ms=sorted(times)[len(times) // 2], best=min(times), seconds=seconds, peak=peak, clipped=clipped))
    finally:
        process.kill()
        process.wait()
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parent.parent / 'src-tauri/binaries/natural-voice')
    parser.add_argument('--out', type=Path, default=Path('/tmp/et-voice-samples'))
    parser.add_argument('--steps', type=int, nargs='+', default=[5, 8, 10])
    parser.add_argument('--voices', type=int, nargs='+', default=[0, 1, 5, 6])
    parser.add_argument('--rounds', type=int, default=3)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    rows = [row for steps in args.steps for row in run(args.directory, steps, args.voices, args.out, args.rounds)]
    lines = ['# Voice samples', '', 'Files: `<steps>/voice<id>-<n>.wav`. Sentence 9 is a typical first phrase.', '']
    for n, text in enumerate(SENTENCES + [FIRST_PHRASE], 1):
        lines.append(f'{n}. {text}')
    lines += ['', '## Summary per steps', '', '| steps | median ms | best ms | median ms (first phrase) | best ms (first phrase) | median RTF | peak | clipped samples |', '|---|---|---|---|---|---|---|---|']
    for steps in args.steps:
        mine = [r for r in rows if r['steps'] == steps]
        first = sorted(r['ms'] for r in mine if r['n'] == 9)
        first_best = min(r['best'] for r in mine if r['n'] == 9)
        best = sorted(r['best'] for r in mine)
        rtf = sorted(r['ms'] / 1000 / r['seconds'] for r in mine)
        ms = sorted(r['ms'] for r in mine)
        lines.append(f"| {steps} | {ms[len(ms)//2]:.0f} | {best[len(best)//2]:.0f} | {first[len(first)//2]:.0f} | {first_best:.0f} | {rtf[len(rtf)//2]:.3f} | {max(r['peak'] for r in mine)} | {sum(r['clipped'] for r in mine)} |")
    lines += ['', '## Every file', '', '| file | chars | synth ms | audio s | RTF | peak | clipped |', '|---|---|---|---|---|---|---|']
    for r in rows:
        lines.append(f"| {r['steps']}/voice{r['voice']}-{r['n']}.wav | {r['chars']} | {r['ms']:.0f} | {r['seconds']:.2f} | {r['ms'] / 1000 / r['seconds']:.3f} | {r['peak']} | {r['clipped']} |")
    (args.out / 'index.md').write_text('\n'.join(lines) + '\n')
    print('\n'.join(lines[lines.index('## Summary per steps'):lines.index('## Every file')]))


if __name__ == '__main__':
    main()
