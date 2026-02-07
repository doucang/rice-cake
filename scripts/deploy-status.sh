#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: run this inside a git repository." >&2
  exit 1
fi
cd "${ROOT}"

DEPLOY_SSH_USER="${DEPLOY_SSH_USER:-root}"
DEPLOY_SSH_HOST="${DEPLOY_SSH_HOST:-47.250.92.76}"
DEPLOY_APP_USER="${DEPLOY_APP_USER:-ricecake}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/ricecake}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-ricecake.service}"

SSH_OPTS_DEFAULT=(
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=3
  -o StrictHostKeyChecking=accept-new
)

if [[ -n "${DEPLOY_SSH_OPTS:-}" ]]; then
  # shellcheck disable=SC2206
  SSH_OPTS=(${DEPLOY_SSH_OPTS})
else
  SSH_OPTS=("${SSH_OPTS_DEFAULT[@]}")
fi

echo "==> local"
echo "cwd: ${ROOT}"
git --no-pager log -1 --oneline --decorate
git --no-pager describe --tags --always --dirty || true
echo

echo "==> remote (${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST})"
ssh "${SSH_OPTS[@]}" "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" bash -s -- \
  "${DEPLOY_APP_USER}" \
  "${DEPLOY_DIR}" \
  "${DEPLOY_SERVICE}" <<'REMOTE'
set -euo pipefail

APP_USER="$1"
APP_DIR="$2"
SERVICE="$3"

echo "host: $(hostname)"
echo -n "service: ${SERVICE} = "
systemctl is-active "${SERVICE}" || true

sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" <<'APP'
set -euo pipefail
APP_DIR="$1"
cd "${APP_DIR}"

echo "dir: ${APP_DIR}"
echo -n "ref: "
git rev-parse --short HEAD
echo -n "version: "
git describe --tags --always
echo -n "commit: "
git --no-pager log -1 --oneline --decorate

if [[ -f .deploy-prev ]]; then
  prev="$(cat .deploy-prev || true)"
  if [[ -n "${prev}" ]]; then
    echo -n "prev: "
    echo "${prev}" | cut -c1-12
    echo "changes since prev:"
    git --no-pager log --oneline "${prev}..HEAD" || true
  fi
else
  echo "recent commits (latest 10):"
  git --no-pager log --oneline -n 10 || true
fi

if [[ -f .deploy-history ]]; then
  echo "deploy history (latest 10):"
  tail -n 10 .deploy-history || true
fi
APP
REMOTE
