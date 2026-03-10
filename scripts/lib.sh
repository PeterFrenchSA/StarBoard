#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
export ENV_FILE

log() {
  printf "\n[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

warn() {
  printf "\n[WARN] %s\n" "$*" >&2
}

die() {
  printf "\n[ERROR] %s\n" "$*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
}

env_path() {
  printf "%s/%s" "$APP_DIR" "$ENV_FILE"
}

compose_path() {
  printf "%s/%s" "$APP_DIR" "$COMPOSE_FILE"
}

load_env() {
  local path
  path="$(env_path)"
  [ -f "$path" ] || die "Environment file not found: $path"
  set -a
  # shellcheck disable=SC1090
  . "$path"
  set +a
}

compose() {
  docker compose -f "$(compose_path)" --env-file "$(env_path)" "$@"
}

wait_for_db() {
  local retries="${1:-45}"
  local sleep_seconds="${2:-2}"
  local i

  log "Waiting for PostgreSQL health..."
  for i in $(seq 1 "$retries"); do
    if compose exec -T db pg_isready -U "${POSTGRES_USER:-starboard}" -d "${POSTGRES_DB:-starboard}" >/dev/null 2>&1; then
      log "PostgreSQL is healthy."
      return 0
    fi
    sleep "$sleep_seconds"
  done

  die "PostgreSQL did not become healthy in time."
}

wait_for_app() {
  local retries="${1:-45}"
  local sleep_seconds="${2:-2}"
  local health_url="${APP_HEALTHCHECK_URL:-http://127.0.0.1:${APP_PORT:-3000}/api/auth/me}"
  local i
  local code

  require_cmd curl
  log "Waiting for app health at ${health_url}..."

  for i in $(seq 1 "$retries"); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$health_url" || true)"
    if [ "$code" = "200" ] || [ "$code" = "204" ] || [ "$code" = "401" ] || [ "$code" = "403" ]; then
      log "App health check passed with status ${code}."
      return 0
    fi
    sleep "$sleep_seconds"
  done

  die "App health check failed for ${health_url}."
}

checkout_branch() {
  local branch="$1"

  git fetch "$GIT_REMOTE" --prune

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git checkout "$branch" >/dev/null
  else
    git checkout -b "$branch" "$GIT_REMOTE/$branch" >/dev/null
  fi

  git pull --ff-only "$GIT_REMOTE" "$branch"
}

record_deploy() {
  local commit_sha="$1"
  local branch="$2"
  local log_file="${APP_DIR}/deployments.log"

  printf "%s branch=%s commit=%s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$branch" "$commit_sha" >> "$log_file"
}
