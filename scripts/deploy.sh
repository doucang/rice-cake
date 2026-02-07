#!/usr/bin/env bash
set -euo pipefail

# One-command deploy:
# 1) git push
# 2) ssh to server -> git pull --ff-only
# 3) systemctl restart service
# 4) optional healthcheck

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
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://localhost:3000/}"

# Set to 1 if you changed dependencies (package-lock.json / package.json).
DEPLOY_RUN_NPM_CI="${DEPLOY_RUN_NPM_CI:-0}"

# By default, refuse to deploy with uncommitted changes, to avoid confusion.
DEPLOY_ALLOW_DIRTY="${DEPLOY_ALLOW_DIRTY:-0}"

SSH_OPTS_DEFAULT=(
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=3
  -o StrictHostKeyChecking=accept-new
)

if [[ -n "${DEPLOY_SSH_OPTS:-}" ]]; then
  # If provided, let users fully override SSH options.
  # shellcheck disable=SC2206
  SSH_OPTS=(${DEPLOY_SSH_OPTS})
else
  SSH_OPTS=("${SSH_OPTS_DEFAULT[@]}")
fi

if [[ "${DEPLOY_ALLOW_DIRTY}" != "1" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Error: working tree is not clean. Commit/stash changes before deploy." >&2
    echo "Tip: set DEPLOY_ALLOW_DIRTY=1 to bypass (not recommended)." >&2
    git status -sb >&2
    exit 1
  fi
fi

echo "==> git push"
git push

echo "==> deploy to ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST} (${DEPLOY_DIR}, ${DEPLOY_SERVICE})"
ssh "${SSH_OPTS[@]}" "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" bash -s -- \
  "${DEPLOY_APP_USER}" \
  "${DEPLOY_DIR}" \
  "${DEPLOY_SERVICE}" \
  "${DEPLOY_HEALTHCHECK_URL}" \
  "${DEPLOY_RUN_NPM_CI}" <<'REMOTE'
set -euo pipefail

APP_USER="$1"
APP_DIR="$2"
SERVICE="$3"
HEALTH_URL="$4"
RUN_NPM_CI="$5"

echo "[remote] whoami: $(whoami)"
echo "[remote] app user: ${APP_USER}"
echo "[remote] app dir: ${APP_DIR}"
echo "[remote] service: ${SERVICE}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "[remote] Error: ${APP_DIR} is not a git repository." >&2
  exit 1
fi

echo "[remote] git pull --ff-only"
sudo -u "${APP_USER}" -H bash -lc "cd '${APP_DIR}' && git pull --ff-only"

if [[ "${RUN_NPM_CI}" == "1" ]]; then
  echo "[remote] npm ci --omit=dev"
  sudo -u "${APP_USER}" -H bash -lc "cd '${APP_DIR}' && npm ci --omit=dev"
fi

echo "[remote] systemctl restart ${SERVICE}"
systemctl restart "${SERVICE}"
systemctl is-active --quiet "${SERVICE}"

if command -v curl >/dev/null 2>&1; then
  echo "[remote] healthcheck: ${HEALTH_URL}"
  ok=0
  for i in $(seq 1 20); do
    if curl -fsS --max-time 2 "${HEALTH_URL}" >/dev/null; then
      ok=1
      break
    fi
    sleep 0.5
  done

  if [[ "${ok}" != "1" ]]; then
    echo "[remote] Error: healthcheck failed after retries." >&2
    echo "[remote] Hint: check service logs with: journalctl -u ${SERVICE} -n 200 --no-pager" >&2
    exit 1
  fi
else
  echo "[remote] curl not found; skipping healthcheck"
fi

echo "[remote] OK"
REMOTE

echo "==> done"
