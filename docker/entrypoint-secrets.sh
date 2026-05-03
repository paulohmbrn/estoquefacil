#!/bin/sh
# Entrypoint comum: garante que /secrets pertence ao user runtime (1001).
# Necessário porque o volume Docker Swarm é criado como root:root 755 e o
# container roda como user não-root, então sem esse fix o app não consegue
# escrever certificados.
# Roda como root e depois faz exec via su-exec pra cair no user designado.

set -e
RUNTIME_USER="${RUNTIME_USER:-nextjs}"
RUNTIME_UID="${RUNTIME_UID:-1001}"
RUNTIME_GID="${RUNTIME_GID:-1001}"

if [ -d "/secrets" ]; then
  chown -R "${RUNTIME_UID}:${RUNTIME_GID}" /secrets || true
  chmod 770 /secrets || true
fi

exec su-exec "${RUNTIME_USER}" "$@"
