#!/bin/bash
# Atualiza o projeto sem derrubar o servidor
set -e
APP_DIR="/var/www/nr13"

echo "[1/4] Copiando novos arquivos..."
cp -r backend/. $APP_DIR/backend/
cp -r frontend/. $APP_DIR/frontend/

echo "[2/4] Recompilando backend..."
cd $APP_DIR/backend && npm install && npm run build

echo "[3/4] Recompilando frontend..."
cd $APP_DIR/frontend && npm install && npm run build

echo "[4/4] Reiniciando com PM2 (zero downtime)..."
cd $APP_DIR && pm2 reload ecosystem.config.js

echo "Update concluído! $(date)"
pm2 status
