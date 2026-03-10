#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/starboard}"
REPO_URL="${REPO_URL:-https://github.com/PeterFrenchSA/StarBoard.git}"
BRANCH="${BRANCH:-main}"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap script supports Ubuntu/Debian hosts only."
  exit 1
fi

sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

if ! docker compose version >/dev/null 2>&1; then
  sudo apt-get install -y docker-compose-plugin
fi

if ! getent group docker >/dev/null; then
  sudo groupadd docker
fi

sudo usermod -aG docker "$USER"

sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

git fetch origin
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi

git pull --ff-only origin "$BRANCH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Edit production secrets before deploy."
fi

./scripts/deploy.sh

echo "Bootstrap complete."
echo "If docker commands still require sudo, log out and log back in."
