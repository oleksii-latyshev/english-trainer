#!/usr/bin/env python3
"""Benchmark the real bundled speech helper with synthetic English, without playing audio."""
import argparse
import json
import os
from pathlib import Path
import select
import struct
import subprocess
import time


def read_exact(pipe, size, timeout=5):
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parent.parent / 'src-tauri/binaries/natural-voice')
    parser.add_argument('--sample', type=Path)
    parser.add_argument('--max-p95-ms', type=float, default=750)
    args = parser.parse_args()
    started = time.monotonic()
    process = subprocess.Popen([str(args.directory / 'speech'), str(args.directory / 'model')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    measurements = []
    try:
        if read_exact(process.stdout, 4) != b'TTS1':
            raise RuntimeError('Invalid local speech protocol')
        load_ms = (time.monotonic() - started) * 1000
        lines = ['Hi!', 'That sounds like a useful approach.', 'What would you try first?', 'Hi! What have you been up to today?', 'I usually start by breaking the problem down.']
        for round_index in range(4):
            for line in lines:
                data = line.encode()
                started = time.monotonic()
                process.stdin.write(struct.pack('<IIf', len(data), 0, 1) + data)
                process.stdin.flush()
                size, = struct.unpack('<I', read_exact(process.stdout, 4))
                if not 44 <= size <= 5292044:
                    raise RuntimeError('Invalid speech audio frame')
                wav = read_exact(process.stdout, size)
                elapsed = (time.monotonic() - started) * 1000
                if round_index:
                    measurements.append(elapsed)
                if args.sample and round_index == 1 and line == lines[-1]:
                    args.sample.write_bytes(wav)
        ordered = sorted(measurements)
        p95 = ordered[min(len(ordered) - 1, int(len(ordered) * .95))]
        print(json.dumps({'model': 'supertonic-3-int8', 'steps': int(os.environ.get('ENGLISH_TRAINER_VOICE_STEPS', 8)), 'threads': 2, 'load_ms': round(load_ms, 1), 'warm_samples': len(ordered), 'median_ms': round(ordered[len(ordered)//2], 1), 'p95_ms': round(p95, 1), 'max_ms': round(max(ordered), 1), 'metric': 'generation_to_complete_wav_not_speaker_onset'}))
        if p95 > args.max_p95_ms:
            raise SystemExit('Speech generation regressed beyond the configured latency budget')
    finally:
        process.kill()
        process.wait()


if __name__ == '__main__':
    main()
