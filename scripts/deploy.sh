#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

RUN_SEED="${RUN_SEED:-false}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-false}"

main() {
  require_cmd git
  require_cmd docker

  cd "$APP_DIR"
  load_env

  local branch="${DEPLOY_BRANCH:-${BRANCH:-main}}"

  log "Starting deployment"
  log "App dir: ${APP_DIR}"
  log "Compose file: $(compose_path)"
  log "Env file: $(env_path)"

  if [ "$SKIP_GIT_PULL" != "true" ]; then
    log "Syncing code from ${GIT_REMOTE}/${branch}"
    checkout_branch "$branch"
  else
    log "Skipping git pull (SKIP_GIT_PULL=true)"
  fi

  local commit_sha
  commit_sha="$(git rev-parse --short HEAD)"
  log "Deploying commit ${commit_sha}"

  log "Building application image"
  compose build app

  log "Starting database container"
  compose up -d db
  wait_for_db

  log "Running Prisma migrations"
  compose run --rm app npm run prisma:deploy

  if [ "$RUN_SEED" = "true" ]; then
    log "RUN_SEED=true -> running seed"
    compose run --rm app npm run prisma:seed
  else
    log "Skipping seed (RUN_SEED=false)"
  fi

  log "Starting/updating app container"
  compose up -d --no-deps app

  wait_for_app

  log "Pruning dangling images"
  docker image prune -f >/dev/null || warn "Image prune failed (non-fatal)"

  record_deploy "$commit_sha" "$branch"

  log "Deployment succeeded"
  log "Active commit: ${commit_sha}"
}

main "$@"
