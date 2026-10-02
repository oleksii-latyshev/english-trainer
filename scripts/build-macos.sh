#!/bin/sh
set -eu

if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  echo 'This personal alpha build requires an Apple Silicon Mac.' >&2
  exit 1
fi

if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Library/Developer/CommandLineTools ]; then
  export DEVELOPER_DIR=/Library/Developer/CommandLineTools
fi

# Ad-hoc signing is configured for personal use; Apple notarization needs credentials.
# Skip Finder automation so local and CI packaging need no Automation permission.
export CI=true
bunx tauri build --bundles app,dmg --ci -- --locked
