#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
git diff --check
pnpm install --frozen-lockfile
pnpm run check
pnpm exec vitest run server/auth.logout.test.ts server/memberAuth.test.ts
pnpm run build

echo "Local CI passed. Safe to commit and push."
