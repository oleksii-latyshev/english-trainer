#!/bin/sh
set -eu

# dmgbuild writes the window layout straight into the volume, so no Finder Automation is needed.
DMGBUILD_VERSION=1.6.7

root=$(cd "$(dirname "$0")/.." && pwd)
bundle="$root/src-tauri/target/release/bundle"
app="$bundle/macos/English Trainer.app"
output="$bundle/dmg/English Trainer.dmg"
venv="$root/src-tauri/target/dmgbuild-venv"

if [ ! -x "$venv/bin/dmgbuild" ]; then
  python3 -m venv "$venv"
  "$venv/bin/pip" install --quiet "dmgbuild==$DMGBUILD_VERSION"
fi

mkdir -p "$bundle/dmg"
rm -f "$output"
"$venv/bin/dmgbuild" \
  -s "$root/src-tauri/dmg/settings.py" \
  -D app="$app" \
  -D background="$root/src-tauri/dmg/background.tiff" \
  -D volume_icon="$root/src-tauri/icons/icon.icns" \
  "English Trainer" "$output"
