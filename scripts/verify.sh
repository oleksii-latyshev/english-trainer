#!/bin/sh
set -eu

bun run typecheck
bun run check
bun test src
bun run check:rust
bun run typecheck:e2e
bun run test:e2e
