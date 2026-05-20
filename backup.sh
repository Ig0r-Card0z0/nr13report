#!/bin/bash
# Backup diário do banco SQLite — adicionar ao crontab:
# 0 2 * * * /var/www/nr13/backup.sh >> /var/www/nr13/logs/backup.log 2>&1

APP_DIR="/var/www/nr13"
BACKUP_DIR="$APP_DIR/backups"
DB_FILE="$APP_DIR/data/nr13.sqlite"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

mkdir -p $BACKUP_DIR

if [ -f "$DB_FILE" ]; then
  sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/nr13_$DATE.sqlite'"
  gzip "$BACKUP_DIR/nr13_$DATE.sqlite"
  echo "[$DATE] Backup criado: nr13_$DATE.sqlite.gz"
  # Remove backups antigos
  find $BACKUP_DIR -name "*.gz" -mtime +$KEEP_DAYS -delete
  echo "[$DATE] Backups mantidos: $(ls $BACKUP_DIR | wc -l)"
else
  echo "[$DATE] AVISO: banco não encontrado em $DB_FILE"
fi
