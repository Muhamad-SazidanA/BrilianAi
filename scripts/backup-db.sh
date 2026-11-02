#!/usr/bin/env bash
# ==============================================================================
# Brilian.Ai - Automated Production Database Backup Script
# Creates a compressed, timestamped pg_dump of the PostgreSQL + pgvector database.
# Supports retention policy (auto-pruning) and optional cloud upload.
# ==============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# Load environment variables if .env exists
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # export variables ignoring comments
  export $(grep -v '^#' "${PROJECT_ROOT}/.env" | xargs -0) 2>/dev/null || true
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-brilian_db}"
CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-brilian_postgres}"

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/brilian_backup_${TIMESTAMP}.sql.gz"

echo "===================================================================="
echo "[Brilian.Ai Backup] Starting PostgreSQL Backup: ${TIMESTAMP}"
echo "[Brilian.Ai Backup] Target Database: ${POSTGRES_DB} (User: ${POSTGRES_USER})"
echo "===================================================================="

# Check if running in Docker host or direct Postgres
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[Brilian.Ai Backup] Executing pg_dump via Docker container: ${CONTAINER_NAME}..."
  docker exec -t "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --clean --if-exists | gzip > "${BACKUP_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "[Brilian.Ai Backup] Executing pg_dump via local binary..."
  PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" --no-owner --clean --if-exists | gzip > "${BACKUP_FILE}"
else
  echo "[Brilian.Ai Backup] ERROR: Neither docker container '${CONTAINER_NAME}' nor local 'pg_dump' found!"
  exit 1
fi

# Verify backup file created and not empty
if [ -s "${BACKUP_FILE}" ]; then
  FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
  echo "[Brilian.Ai Backup] SUCCESS: Backup archive created (${FILE_SIZE})"
  echo "[Brilian.Ai Backup] Path: ${BACKUP_FILE}"
else
  echo "[Brilian.Ai Backup] ERROR: Backup file is empty or missing!"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Auto-prune old backups older than RETENTION_DAYS
echo "[Brilian.Ai Backup] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "brilian_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -vf {} \; || true

# Optional Cloud Storage Upload (e.g. AWS S3 / Cloudflare R2 / MinIO)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "[Brilian.Ai Backup] Uploading backup to S3/R2 bucket: ${BACKUP_S3_BUCKET}..."
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/backups/$(basename "${BACKUP_FILE}")"
    echo "[Brilian.Ai Backup] Remote S3 upload complete."
  elif command -v rclone >/dev/null 2>&1; then
    rclone copy "${BACKUP_FILE}" "${BACKUP_S3_BUCKET}:backups/"
    echo "[Brilian.Ai Backup] Remote rclone upload complete."
  else
    echo "[Brilian.Ai Backup] Notice: BACKUP_S3_BUCKET is set but neither 'aws' nor 'rclone' CLI is installed."
  fi
fi

echo "[Brilian.Ai Backup] Backup procedure finished successfully."

