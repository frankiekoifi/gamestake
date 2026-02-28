#!/bin/bash
# scripts/restore.sh

set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore.sh <backup-file>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Starting database restore from $BACKUP_FILE..."

# Stop backend to prevent connections
docker-compose stop backend

# Drop and recreate database
docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS gamestake;"
docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE gamestake;"

# Restore from backup
cat $BACKUP_FILE | docker-compose exec -T postgres psql -U postgres -d gamestake

# Restart backend
docker-compose start backend

echo "✅ Restore completed"