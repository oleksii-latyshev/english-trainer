#!/usr/bin/env bash
# Fetches the official whisper.cpp Windows builds into src-tauri/resources/whisper-windows
# (cuda/ and cpu/), pinned by release tag and SHA-256. Bundled by tauri.windows.conf.json.
set -euo pipefail

TAG="b5907"
BASE="https://github.com/ggml-org/whisper.cpp/releases/download/${TAG}"
CUDA_ZIP="whisper-bin-win-cuda-12.4.0-x64.zip"
CUDA_SHA256="34f872ce724ca1ff0a4afca481853e5ee74250f8cb22153e499f953562846039"
CPU_ZIP="whisper-bin-x64.zip"
CPU_SHA256="ecca07b277d943e9b9f4712856a144b857271a6b333104e511e1988e80db582b"

root="$(cd "$(dirname "$0")/.." && pwd)"
target="$root/src-tauri/resources/whisper-windows"
cache="${WHISPER_DOWNLOAD_CACHE:-$root/src-tauri/resources/.whisper-downloads}"

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1 | tr -d '\\'
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

extract() {
  if command -v unzip >/dev/null 2>&1; then
    unzip -q -o "$1" -d "$2"
  elif command -v 7z >/dev/null 2>&1; then
    7z x -y -o"$2" "$1" >/dev/null
  else
    tar -xf "$1" -C "$2"
  fi
}

fetch() {
  local zip="$1" expected="$2" backend="$3"
  mkdir -p "$cache"
  local archive="$cache/${TAG}-$zip"
  if [ ! -f "$archive" ] || [ "$(sha256_of "$archive")" != "$expected" ]; then
    curl --fail --location --silent --show-error "$BASE/$zip" --output "$archive"
  fi
  local actual
  actual="$(sha256_of "$archive")"
  if [ "$actual" != "$expected" ]; then
    echo "checksum mismatch for $zip: expected $expected, got $actual" >&2
    rm -f "$archive"
    exit 1
  fi
  local staging
  staging="$(mktemp -d)"
  extract "$archive" "$staging"
  rm -rf "${target:?}/$backend"
  mkdir -p "$target/$backend"
  cp -R "$staging/Release/." "$target/$backend/"
  rm -rf "$staging"
  test -f "$target/$backend/whisper-server.exe"
  test -f "$target/$backend/whisper-cli.exe"
  echo "whisper $TAG $backend ready in $target/$backend"
}

fetch "$CUDA_ZIP" "$CUDA_SHA256" cuda
fetch "$CPU_ZIP" "$CPU_SHA256" cpu
