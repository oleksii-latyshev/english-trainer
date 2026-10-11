#!/bin/sh
set -eu

# Use the installed command-line SDK without changing the machine's Xcode selection.
if [ -z "${DEVELOPER_DIR:-}" ] && [ "$(uname -s)" = Darwin ] && [ -d /Library/Developer/CommandLineTools ]; then
  export DEVELOPER_DIR=/Library/Developer/CommandLineTools
fi

cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml

fail_on_stale_bindings() {
  bindings=src/core/ipc/bindings
  untracked_bindings=$(git ls-files --others --exclude-standard -- "$bindings")
  if ! git diff --exit-code --stat -- "$bindings" || [ -n "$untracked_bindings" ]; then
    [ -z "$untracked_bindings" ] || printf 'Untracked generated bindings:\n%s\n' "$untracked_bindings"
    echo "Generated IPC bindings are out of date. Commit (or stage) the files in $bindings." >&2
    exit 1
  fi
}

fail_on_stale_bindings
