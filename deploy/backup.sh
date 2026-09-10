#!/usr/bin/env bash
#
# Бэкап базы PostgreSQL и фото чеков.
# Ставится на сервер в /usr/local/bin/budget-backup и запускается по cron:
#
#   0 4 * * * /usr/local/bin/budget-backup
#
# Хранит последние 14 копий.

set -euo pipefail

DATA_DIR=/var/lib/budget
BACKUP_DIR=/var/backups/budget
DB_NAME=budget
KEEP=14
STAMP=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUP_DIR"

# pg_dump снимает согласованный слепок на работающей базе.
su - postgres -c "pg_dump -Fc $DB_NAME" > "$BACKUP_DIR/budget-$STAMP.dump"

if [[ -d "$DATA_DIR/uploads" ]] && [[ -n "$(ls -A "$DATA_DIR/uploads" 2>/dev/null)" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
fi

# Чистим старое.
ls -1t "$BACKUP_DIR"/budget-*.dump 2>/dev/null | tail -n "+$((KEEP+1))" | xargs -r rm --
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n "+$((KEEP+1))" | xargs -r rm --

echo "Бэкап готов: $BACKUP_DIR/budget-$STAMP.dump"
