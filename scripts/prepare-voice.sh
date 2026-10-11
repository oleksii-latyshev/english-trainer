#!/bin/sh
set -eu
# Pinned assets are build inputs, never downloaded by a learner's running app.
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DEST="$ROOT/src-tauri/binaries/natural-voice"
CACHE="${TMPDIR:-/tmp}/english-trainer-voice-assets"
mkdir -p "$CACHE" "$DEST"
fetch() {
  name="$1" hash="$2" url="$3"
  if [ ! -f "$CACHE/$name" ]; then
    curl --fail --location --retry 2 "$url" -o "$CACHE/$name.partial"
    mv "$CACHE/$name.partial" "$CACHE/$name"
  fi
  printf '%s  %s\n' "$hash" "$CACHE/$name" | shasum -a 256 -c -
}
fetch runtime.tar.bz2 b10e5c7e2c30ea03de9c442655d14860d9edc475c6251d58a8f5f06e913a1d56 https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-osx-arm64-shared.tar.bz2
fetch model.tar.bz2 82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2
if [ ! -d "$CACHE/sherpa-onnx-v1.13.8-osx-arm64-shared" ]; then tar -xjf "$CACHE/runtime.tar.bz2" -C "$CACHE"; fi
if [ ! -d "$DEST/model" ]; then
  tar -xjf "$CACHE/model.tar.bz2" -C "$CACHE"
  cp -R "$CACHE/sherpa-onnx-supertonic-3-tts-int8-2026-05-11" "$DEST/model"
fi
mkdir -p "$DEST/lib"
cp "$CACHE/sherpa-onnx-v1.13.8-osx-arm64-shared/lib/libsherpa-onnx-c-api.dylib" "$DEST/lib/"
cp -L "$CACHE/sherpa-onnx-v1.13.8-osx-arm64-shared/lib/libonnxruntime.dylib" "$DEST/lib/"
cp -R "$ROOT/src-tauri/voice/licenses" "$DEST/"
xcrun clang++ -std=c++17 -O2 -arch arm64 -mmacosx-version-min=14.0 \
  -I"$CACHE/sherpa-onnx-v1.13.8-osx-arm64-shared/include" \
  "$ROOT/src-tauri/voice/Speech.cpp" -L"$DEST/lib" -lsherpa-onnx-c-api \
  -Wl,-rpath,@executable_path/lib -o "$DEST/speech"
for file in "$DEST/lib/"*.dylib "$DEST/speech"; do codesign --force --sign - "$file"; done
