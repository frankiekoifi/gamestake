#!/bin/bash
# scripts/backup.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/gamestake_$TIMESTAMP.sql"

echo "📦 Starting database backup..."

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Run backup
docker-compose exec -T postgres pg_dump -U postgres gamestake > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "gamestake_*.sql.gz" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_FILE.gz"