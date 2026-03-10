#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

main() {
  require_cmd git

  cd "$APP_DIR"
  local previous_commit
  previous_commit="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"

  log "Starting application update"
  log "Current commit: ${previous_commit}"

  if RUN_SEED="${RUN_SEED:-false}" SKIP_GIT_PULL=false DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}" "${SCRIPT_DIR}/deploy.sh"; then
    local current_commit
    current_commit="$(git rev-parse --short HEAD)"
    log "Update successful: ${previous_commit} -> ${current_commit}"
    return 0
  fi

  warn "Update failed. Current checkout may be unchanged or partially updated."
  warn "Run rollback: ENV_FILE=${ENV_FILE:-.env.production} ./rollback.sh"
  exit 1
}

main "$@"
