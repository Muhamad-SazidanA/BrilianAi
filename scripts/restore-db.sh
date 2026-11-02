#!/usr/bin/env bash
# ==============================================================================
# Brilian.Ai - Production Database Restore Script
# Restores a compressed PostgreSQL (.sql.gz) backup archive to the database.
# CAUTION: This will overwrite tables in the target database!
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -f "${PROJECT_ROOT}/.env" ]; then
  export $(grep -v '^#' "${PROJECT_ROOT}/.env" | xargs -0) 2>/dev/null || true
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-brilian_db}"
CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-brilian_postgres}"

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  echo "Example: $0 ./backups/brilian_backup_20261029_120000.sql.gz"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[Brilian.Ai Restore] ERROR: File '${BACKUP_FILE}' not found!"
  exit 1
fi

echo "===================================================================="
echo "[Brilian.Ai Restore] WARNING: You are about to restore:"
echo "Archive:  ${BACKUP_FILE}"
echo "Target DB: ${POSTGRES_DB} (User: ${POSTGRES_USER})"
echo "===================================================================="
read -p "Are you sure you want to proceed with restore? [y/N]: " CONFIRM
if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
  echo "[Brilian.Ai Restore] Aborted by user."
  exit 0
fi

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[Brilian.Ai Restore] Restoring via Docker container '${CONTAINER_NAME}'..."
  gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
else
  echo "[Brilian.Ai Restore] Restoring via local psql..."
  PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" gunzip -c "${BACKUP_FILE}" | psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}"
fi

echo "[Brilian.Ai Restore] SUCCESS: Database restored successfully from ${BACKUP_FILE}"

