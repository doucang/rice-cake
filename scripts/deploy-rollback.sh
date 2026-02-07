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
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://localhost:3000/}"

# Set to 1 if you want to force reinstall dependencies during rollback.
# If set to 0, rollback will auto-run npm ci only when package.json/lock changed.
DEPLOY_RUN_NPM_CI="${DEPLOY_RUN_NPM_CI:-0}"

# Optional: rollback to a specific ref (tag/commit). If empty, rollback to .deploy-prev (or HEAD^).
ROLLBACK_REF="${1:-}"

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

echo "==> rollback on ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"
ssh "${SSH_OPTS[@]}" "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" bash -s -- \
  "${DEPLOY_APP_USER}" \
  "${DEPLOY_DIR}" \
  "${DEPLOY_SERVICE}" \
  "${DEPLOY_HEALTHCHECK_URL}" \
  "${DEPLOY_RUN_NPM_CI}" \
  "${ROLLBACK_REF}" <<'REMOTE'
set -euo pipefail

APP_USER="$1"
APP_DIR="$2"
SERVICE="$3"
HEALTH_URL="$4"
RUN_NPM_CI="$5"
ROLLBACK_REF="${6:-}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "[remote] Error: ${APP_DIR} is not a git repository." >&2
  exit 1
fi

current_ref="$(sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" <<'APP'
set -euo pipefail
cd "$1"
git rev-parse HEAD
APP
)"

current_line="$(sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" <<'APP'
set -euo pipefail
cd "$1"
git log -1 --format='%h %s' --no-color
APP
)"

target_ref=""
if [[ -n "${ROLLBACK_REF}" ]]; then
  target_ref="${ROLLBACK_REF}"
elif [[ -f "${APP_DIR}/.deploy-prev" ]]; then
  target_ref="$(cat "${APP_DIR}/.deploy-prev" || true)"
fi

if [[ -z "${target_ref}" ]]; then
  target_ref="$(sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" <<'APP'
set -euo pipefail
cd "$1"
git rev-parse HEAD^
APP
)"
fi

sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" "${target_ref}" <<'APP'
set -euo pipefail
cd "$1"
git cat-file -e "${2}^{commit}"
APP

target_line="$(sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" "${target_ref}" <<'APP'
set -euo pipefail
cd "$1"
git log -1 --format='%h %s' "$2" --no-color
APP
)"

echo "[remote] current: ${current_line}"
echo "[remote] target : ${target_line}"

dirty="$(sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" <<'APP'
set -euo pipefail
cd "$1"
git status --porcelain
APP
)"
if [[ -n "${dirty}" ]]; then
  echo "[remote] Error: ${APP_DIR} has local changes; refusing rollback." >&2
  echo "${dirty}" >&2
  exit 1
fi

echo "[remote] commits to be rolled back:"
sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" "${target_ref}" "${current_ref}" <<'APP'
set -euo pipefail
cd "$1"
git --no-pager log --oneline "${2}..${3}" || true
APP

needs_npm_ci="0"
if [[ "${RUN_NPM_CI}" == "1" ]]; then
  needs_npm_ci="1"
else
  changed="$(sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" "${target_ref}" "${current_ref}" <<'APP'
set -euo pipefail
cd "$1"
git diff --name-only "$2" "$3" -- package.json package-lock.json || true
APP
)"
  if [[ -n "${changed}" ]]; then
    needs_npm_ci="1"
  fi
fi

echo "[remote] rollback: resetting working tree"
sudo -u "${APP_USER}" -H bash -s -- "${APP_DIR}" "${current_ref}" "${current_line}" "${target_ref}" "${target_line}" <<'APP'
set -euo pipefail
APP_DIR="$1"
CURRENT_REF="$2"
CURRENT_LINE="$3"
TARGET_REF="$4"
TARGET_LINE="$5"

cd "${APP_DIR}"

# Record current ref for a quick flip-flop rollback.
echo "${CURRENT_REF}" > .deploy-prev

ts="$(date -Is 2>/dev/null || date)"
printf "%s\trollback\t%s\t%s\n" "${ts}" "${CURRENT_LINE}" "${TARGET_LINE}" >> .deploy-history
tail -n 50 .deploy-history > .deploy-history.tmp && mv .deploy-history.tmp .deploy-history

git fetch --all --prune
git checkout -q main
git reset --hard "${TARGET_REF}"
APP

if [[ "${needs_npm_ci}" == "1" ]]; then
  echo "[remote] npm ci --omit=dev (dependencies changed)"
  sudo -u "${APP_USER}" -H bash -lc "cd '${APP_DIR}' && npm ci --omit=dev"
fi

echo "[remote] systemctl restart ${SERVICE}"
systemctl restart "${SERVICE}"
systemctl is-active --quiet "${SERVICE}"

if command -v curl >/dev/null 2>&1; then
  echo "[remote] healthcheck: ${HEALTH_URL}"
  ok=0
  for i in $(seq 1 20); do
    if curl -fsS --max-time 2 "${HEALTH_URL}" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 0.5
  done
  if [[ "${ok}" != "1" ]]; then
    echo "[remote] Error: healthcheck failed after retries." >&2
    echo "[remote] Hint: check service logs with: journalctl -u ${SERVICE} -n 200 --no-pager" >&2
    curl -fsS --max-time 2 "${HEALTH_URL}" >/dev/null
    exit 1
  fi
fi

echo "[remote] OK"
REMOTE
