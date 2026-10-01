#!/bin/sh
set -eu

# Use the installed command-line SDK without changing the machine's Xcode selection.
if [ -z "${DEVELOPER_DIR:-}" ] && [ "$(uname -s)" = Darwin ] && [ -d /Library/Developer/CommandLineTools ]; then
  export DEVELOPER_DIR=/Library/Developer/CommandLineTools
fi

cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml
