#!/usr/bin/env sh

# Source this file from the repository root:
#   . scripts/use-local-toolchain.sh

if [ ! -x "$(pwd)/.tools/node/bin/node" ]; then
  printf '%s\n' 'Node.js local não encontrado em .tools/node.' >&2
  return 1 2>/dev/null || exit 1
fi

export MESA_DIGITAL_ROOT="$(pwd)"
export COREPACK_HOME="$MESA_DIGITAL_ROOT/.tools/corepack"
export PATH="$MESA_DIGITAL_ROOT/.tools/node/bin:$MESA_DIGITAL_ROOT/.tools/bin:$PATH"

printf 'Mesa Digital: Node %s ativado neste shell.\n' "$(node --version)"
