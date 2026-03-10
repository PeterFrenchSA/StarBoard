#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

main() {
  local backup_file="${1:-}"
  [ -n "$backup_file" ] || die "Usage: ./scripts/restore-db.sh <path-to-backup.sql.gz>"
  [ -f "$backup_file" ] || die "Backup file not found: $backup_file"

  cd "$APP_DIR"
  load_env

  log "Restoring backup from ${backup_file}"
  warn "This will replace current database contents."

  compose exec -T db psql -U "${POSTGRES_USER:-starboard}" -d "${POSTGRES_DB:-starboard}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  gunzip -c "$backup_file" | compose exec -T db psql -U "${POSTGRES_USER:-starboard}" -d "${POSTGRES_DB:-starboard}"

  log "Restore complete"
}

main "$@"
