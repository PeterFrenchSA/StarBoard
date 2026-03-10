#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib.sh"

main() {
  require_cmd gzip

  cd "$APP_DIR"
  load_env

  local backup_dir="${BACKUP_DIR:-${APP_DIR}/backups}"
  local retention_days="${BACKUP_RETENTION_DAYS:-14}"
  local timestamp
  timestamp="$(date -u +"%Y%m%d-%H%M%SZ")"
  local file="${backup_dir}/starboard-${timestamp}.sql.gz"

  mkdir -p "$backup_dir"

  log "Creating PostgreSQL backup: ${file}"
  compose exec -T db pg_dump -U "${POSTGRES_USER:-starboard}" -d "${POSTGRES_DB:-starboard}" | gzip > "$file"

  log "Backup complete"

  if [ "$retention_days" -gt 0 ] 2>/dev/null; then
    find "$backup_dir" -type f -name "starboard-*.sql.gz" -mtime "+${retention_days}" -delete
    log "Pruned backups older than ${retention_days} days"
  fi
}

main "$@"
