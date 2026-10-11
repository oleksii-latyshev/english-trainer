#!/bin/sh
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts|*.tsx|*.js|*.json|*.css) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
./node_modules/.bin/biome check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1 || true
exit 0
