#!/bin/sh
# Refresh only the repository containing this script, even if Git changes the hook's cwd.
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P) || exit 0
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd -P) || exit 0
git_root=$(git -C "$repo_root" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ "$git_root" = "$repo_root" ] || exit 0
cbm_bin="$HOME/.local/bin/codebase-memory-mcp"
if [ ! -x "$cbm_bin" ]; then
  cbm_bin=$(command -v codebase-memory-mcp 2>/dev/null) || {
    printf '%s\n' 'Codebase Memory: binary unavailable; index not refreshed.' >&2
    exit 0
  }
fi

if "$cbm_bin" cli --quiet index_repository --repo-path "$repo_root" >/dev/null; then
  printf '%s\n' 'Codebase Memory: index refreshed for this checkout.'
else
  printf '%s\n' 'Codebase Memory: index refresh failed; check the current source before using graph results.' >&2
fi
exit 0
