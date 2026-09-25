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

  local current target
  current="$(git rev-parse HEAD)"
  if [ -f "${APP_DIR}/deployments.log" ]; then
    while IFS= read -r target; do
      target="$(git rev-parse --verify "${target}^{commit}" 2>/dev/null)" || continue
      if [ "$target" != "$current" ]; then
        printf "%s" "$target"
        return
      fi
    done < <(awk '{ for (i=1; i<=NF; i++) if ($i ~ /^commit=/) { sub(/^commit=/, "", $i); commits[++n]=$i } } END { for (i=n; i>0; i--) print commits[i] }' "${APP_DIR}/deployments.log")
  fi
  die "No previous successful deployment found. Set ROLLBACK_COMMIT explicitly."
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

  [ -z "$(git status --porcelain --untracked-files=no)" ] || die "Commit or stash tracked changes before rollback."
  git checkout --detach "$target_commit" >/dev/null

  log "Rebuilding containers for rollback commit"
  compose build app
  compose up -d db
  wait_for_db

  log "Running Prisma migrations for rollback commit"
  compose run --rm app npm run prisma:deploy

  log "Starting app container"
  compose up -d --no-deps app
  wait_for_app

  record_deploy "$(git rev-parse HEAD)" "rollback-${branch}"

  log "Rollback complete"
  log "Active commit: $(git rev-parse --short HEAD)"
}

main "$@"
