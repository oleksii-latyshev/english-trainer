#!/bin/sh
# Builds the natural voice helper for Windows x64. Run from Git Bash in a Visual Studio
# developer environment (cl.exe on PATH). Pinned assets are build inputs, never downloaded by the app.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DEST="$ROOT/src-tauri/resources/natural-voice-windows"
CACHE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/english-trainer-voice-assets-windows"
RUNTIME_NAME=sherpa-onnx-v1.13.8-win-x64-shared-MD-Release
MODEL_NAME=sherpa-onnx-supertonic-3-tts-int8-2026-05-11
mkdir -p "$CACHE" "$DEST"
fetch() {
  name="$1" hash="$2" url="$3"
  if [ ! -f "$CACHE/$name" ]; then
    curl --fail --location --retry 2 "$url" -o "$CACHE/$name.partial"
    mv "$CACHE/$name.partial" "$CACHE/$name"
  fi
  printf '%s  %s\n' "$hash" "$CACHE/$name" | sha256sum -c -
}
fetch runtime.tar.bz2 3e971a04b2e0ba4dfa53d381a006367ce8c9f5f09b4ae00043e9845c2baded22 "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/$RUNTIME_NAME.tar.bz2"
fetch model.tar.bz2 82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427 "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$MODEL_NAME.tar.bz2"
[ -d "$CACHE/$RUNTIME_NAME" ] || tar -xjf "$CACHE/runtime.tar.bz2" -C "$CACHE"
if [ ! -d "$DEST/model" ]; then
  [ -d "$CACHE/$MODEL_NAME" ] || tar -xjf "$CACHE/model.tar.bz2" -C "$CACHE"
  cp -R "$CACHE/$MODEL_NAME" "$DEST/model"
fi
for dll in sherpa-onnx-c-api.dll onnxruntime.dll onnxruntime_providers_shared.dll; do
  cp "$CACHE/$RUNTIME_NAME/lib/$dll" "$DEST/"
done
rm -rf "$DEST/licenses"
cp -R "$ROOT/src-tauri/voice/licenses" "$DEST/licenses"
WORK="$CACHE/build"
mkdir -p "$WORK"
INCLUDE_DIR=$(cygpath -m "$CACHE/$RUNTIME_NAME/include")
LIB_FILE=$(cygpath -m "$CACHE/$RUNTIME_NAME/lib/sherpa-onnx-c-api.lib")
SOURCE=$(cygpath -m "$ROOT/src-tauri/voice/Speech.cpp")
OUT=$(cygpath -m "$DEST/speech.exe")
OBJ=$(cygpath -m "$WORK")/
MSYS2_ARG_CONV_EXCL='*' cl.exe -nologo -std:c++17 -O2 -EHsc -MD -I"$INCLUDE_DIR" -Fo"$OBJ" -Fe"$OUT" "$SOURCE" "$LIB_FILE"
