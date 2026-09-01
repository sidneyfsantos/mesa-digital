#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
. scripts/use-local-toolchain.sh
pnpm db:migrate
pnpm db:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:isolation
pnpm build
git diff --check
if rg -n -I '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-(proj-)?[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN)' --glob '!.git/**' --glob '!scripts/block-validate.sh' .; then
  echo 'Potential secret pattern found.' >&2
  exit 1
fi
git status --short
git diff --stat
