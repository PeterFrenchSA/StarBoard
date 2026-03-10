#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/starboard}"
REPO_URL="${REPO_URL:-https://github.com/PeterFrenchSA/StarBoard.git}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
ENV_TARGET="${ENV_TARGET:-.env.production}"
TARGET_USER="${SUDO_USER:-$USER}"

log() {
  printf "\n[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

die() {
  printf "\n[ERROR] %s\n" "$*" >&2
  exit 1
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

require_ubuntu() {
  [ -f /etc/os-release ] || die "Cannot detect OS: /etc/os-release is missing"
  # shellcheck disable=SC1091
  . /etc/os-release
  [ "${ID:-}" = "ubuntu" ] || die "This script supports Ubuntu only (detected: ${ID:-unknown})"
}

install_git_if_missing() {
  if command -v git >/dev/null 2>&1; then
    log "Git already installed"
    return
  fi

  log "Installing Git"
  as_root apt-get update -y
  as_root apt-get install -y git
}

install_docker_if_missing() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed"
    return
  fi

  log "Installing Docker"
  as_root apt-get update -y
  as_root apt-get install -y ca-certificates curl
  curl -fsSL https://get.docker.com | as_root sh
}

install_compose_plugin_if_missing() {
  if docker compose version >/dev/null 2>&1; then
    log "Docker Compose plugin already installed"
    return
  fi

  log "Installing Docker Compose plugin"
  as_root apt-get update -y
  as_root apt-get install -y docker-compose-plugin
}

setup_docker_group() {
  if ! getent group docker >/dev/null 2>&1; then
    as_root groupadd docker
  fi

  as_root usermod -aG docker "$TARGET_USER" || true
}

prepare_repo() {
  log "Preparing app directory at ${APP_DIR}"
  as_root mkdir -p "$APP_DIR"
  as_root chown -R "$TARGET_USER":"$TARGET_USER" "$APP_DIR"

  if [ -d "$APP_DIR/.git" ]; then
    :
  elif [ -z "$(ls -A "$APP_DIR")" ]; then
    log "Cloning repository"
    git clone "$REPO_URL" "$APP_DIR"
  else
    die "${APP_DIR} exists but is not a git repository. Clean it or set APP_DIR to another path."
  fi

  cd "$APP_DIR"

  git fetch origin --prune
  if git show-ref --verify --quiet "refs/heads/$DEPLOY_BRANCH"; then
    git checkout "$DEPLOY_BRANCH"
  else
    git checkout -b "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
  fi

  git pull --ff-only origin "$DEPLOY_BRANCH"
}

prepare_env_file() {
  cd "$APP_DIR"

  if [ -f "$ENV_TARGET" ]; then
    log "${ENV_TARGET} already exists"
    return
  fi

  if [ -f .env.production.example ]; then
    cp .env.production.example "$ENV_TARGET"
  elif [ -f .env.example ]; then
    cp .env.example "$ENV_TARGET"
  else
    die "No env template found (.env.production.example or .env.example)"
  fi

  log "Created ${ENV_TARGET} from template"
}

main() {
  require_ubuntu
  install_git_if_missing
  install_docker_if_missing
  install_compose_plugin_if_missing
  setup_docker_group
  prepare_repo
  prepare_env_file

  cat <<MSG

Bootstrap complete.

Next steps:
1. cd ${APP_DIR}
2. Edit ${ENV_TARGET} with production values (APP_URL, AUTH_SECRET, VOICE_TOKEN_SALT, DB password)
3. Run first deploy:
   ENV_FILE=${ENV_TARGET} DEPLOY_BRANCH=${DEPLOY_BRANCH} ./deploy.sh

If docker commands still require sudo, log out and log back in to refresh group membership.
MSG
}

main "$@"
