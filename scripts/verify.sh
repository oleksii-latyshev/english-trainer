#!/bin/sh
set -eu

bun run typecheck
bun run check
bun run check:effect
bun run check:conventions
bun run check:knip
bun test src scripts
bun run check:rust
bun run typecheck:e2e
bun run test:e2e
