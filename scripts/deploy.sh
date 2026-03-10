#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from template. Update secrets and run deploy again."
  exit 1
fi

git fetch origin
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi

git pull --ff-only origin "$BRANCH"

docker compose -f docker-compose.prod.yml --env-file .env build app
docker compose -f docker-compose.prod.yml --env-file .env up -d db

for i in $(seq 1 40); do
  if docker compose -f docker-compose.prod.yml --env-file .env exec -T db pg_isready -U "${POSTGRES_USER:-starboard}" -d "${POSTGRES_DB:-starboard}" >/dev/null 2>&1; then
    break
  fi
  sleep 2

done

docker compose -f docker-compose.prod.yml --env-file .env run --rm app npm run prisma:deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps app
docker image prune -f >/dev/null

echo "Deployment complete."
