#!/usr/bin/env python3
"""Runs the bundled speech helper once and writes the reply to a WAV file."""
import argparse
import struct
import subprocess
import threading
from pathlib import Path


def read_exact(pipe, size):
    data = pipe.read(size)
    if len(data) != size:
        raise RuntimeError('Local speech helper exited early')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--executable', default='speech')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--text', default='Hi! What have you been up to today?')
    parser.add_argument('--timeout', type=float, default=120)
    args = parser.parse_args()
    process = subprocess.Popen([str(args.directory / args.executable), str(args.directory / 'model')], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    watchdog = threading.Timer(args.timeout, process.kill)
    watchdog.start()
    try:
        if read_exact(process.stdout, 4) != b'TTS1':
            raise RuntimeError('Invalid local speech protocol')
        data = args.text.encode()
        process.stdin.write(struct.pack('<IIf', len(data), 0, 1) + data)
        process.stdin.flush()
        size, = struct.unpack('<I', read_exact(process.stdout, 4))
        if not 44 <= size <= 5292044:
            raise RuntimeError('Invalid speech audio frame')
        wav = read_exact(process.stdout, size)
        if wav[:4] != b'RIFF' or wav[8:12] != b'WAVE' or size < 20000:
            raise RuntimeError('Speech helper returned no usable audio')
        args.output.write_bytes(wav)
        print(f'Wrote {size} bytes to {args.output}')
    finally:
        watchdog.cancel()
        process.kill()
        process.wait()


if __name__ == '__main__':
    main()
