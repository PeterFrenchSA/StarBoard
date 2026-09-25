#!/bin/sh
set -eu

if ! cmp -s package-lock.json /opt/starboard-package-lock.json; then
  echo "Dependencies changed. Rebuild with: docker compose up -d --build app" >&2
  exit 1
fi

if [ ! -f node_modules/.starboard-package-lock.json ] || ! cmp -s package-lock.json node_modules/.starboard-package-lock.json; then
  echo "Syncing container dependencies from the built image..."
  mkdir -p node_modules
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a /opt/starboard-node_modules/. node_modules/
  cp package-lock.json node_modules/.starboard-package-lock.json
fi

npm run prisma:generate
npm run prisma:deploy
npm run dev -- --webpack -H 0.0.0.0 -p 3000
