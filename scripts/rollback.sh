#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

ROLLBACK_COMMIT="${ROLLBACK_COMMIT:-}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

resolve_target_commit() {
  if [ -n "$ROLLBACK_COMMIT" ]; then
    printf "%s" "$ROLLBACK_COMMIT"
    return
  fi

  git rev-parse --verify HEAD^ 2>/dev/null || die "No previous commit found for rollback"
}

main() {
  require_cmd git
  require_cmd docker

  cd "$APP_DIR"
  load_env

  local branch="${DEPLOY_BRANCH:-${BRANCH:-main}}"
  local current_commit
  current_commit="$(git rev-parse --short HEAD)"

  log "Current commit: ${current_commit}"
  log "Resolving rollback target..."

  git fetch "$GIT_REMOTE" --prune

  local target_commit
  target_commit="$(resolve_target_commit)"
  target_commit="$(git rev-parse --short "$target_commit")"

  log "Rolling back to commit: ${target_commit}"

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git checkout "$branch" >/dev/null
  else
    git checkout -b "$branch" "$GIT_REMOTE/$branch" >/dev/null
  fi

  git reset --hard "$target_commit"

  log "Rebuilding containers for rollback commit"
  compose build app
  compose up -d db
  wait_for_db

  log "Running Prisma migrations for rollback commit"
  compose run --rm app npm run prisma:deploy

  log "Starting app container"
  compose up -d --no-deps app
  wait_for_app

  log "Rollback complete"
  log "Active commit: $(git rev-parse --short HEAD)"
}

main "$@"
