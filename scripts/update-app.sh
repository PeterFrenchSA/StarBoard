#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo ".env not found. Copy .env.example to .env and configure it first."
  exit 1
fi

PREVIOUS_COMMIT="$(git rev-parse HEAD)"

rollback() {
  echo "Update failed. Rolling back to ${PREVIOUS_COMMIT}."
  git checkout "$PREVIOUS_COMMIT"
  docker compose -f docker-compose.prod.yml --env-file .env build app
  docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps app
}

trap rollback ERR

git fetch origin
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi

git pull --ff-only origin "$BRANCH"

docker compose -f docker-compose.prod.yml --env-file .env build app
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npm run prisma:deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps app
docker image prune -f >/dev/null

trap - ERR

echo "Update complete. Previous commit: ${PREVIOUS_COMMIT}"
