#!/bin/bash
# ================================================================
# NR-13 — Script de deploy para servidor Linux (Hostinger VPS)
# Testado em Ubuntu 22.04 / Debian 11
# Uso: bash deploy.sh [dominio.com]
# ================================================================

set -e

DOMAIN="${1:-nr13.exemplo.com.br}"
APP_DIR="/var/www/nr13"
NODE_VERSION="20"

echo ""
echo "=========================================="
echo "  NR-13 — Deploy Hostinger VPS"
echo "  Domínio: $DOMAIN"
echo "=========================================="
echo ""

# ── 1. Dependências do sistema ──────────────────────────
echo "[1/8] Instalando dependências do sistema..."
apt-get update -qq
apt-get install -y curl wget git nginx certbot python3-certbot-nginx build-essential

# Node.js via NVM
if ! command -v node &> /dev/null; then
  echo "Instalando Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi

# PM2
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

echo "  Node: $(node -v) | NPM: $(npm -v) | PM2: $(pm2 -v)"

# ── 2. Estrutura de diretórios ───────────────────────────
echo "[2/8] Criando estrutura de diretórios..."
mkdir -p $APP_DIR/{backend,frontend,data,uploads,logs}
chown -R www-data:www-data $APP_DIR/uploads $APP_DIR/data 2>/dev/null || true

# ── 3. Copiar projeto ────────────────────────────────────
echo "[3/8] Copiando arquivos do projeto..."
cp -r backend/. $APP_DIR/backend/
cp -r frontend/. $APP_DIR/frontend/
cp ecosystem.config.js $APP_DIR/

# ── 4. Instalar dependências ─────────────────────────────
echo "[4/8] Instalando dependências do backend..."
cd $APP_DIR/backend
npm install --production=false

echo "[4/8] Compilando backend NestJS..."
npm run build

echo "[4/8] Instalando dependências do frontend..."
cd $APP_DIR/frontend
npm install

echo "[4/8] Compilando frontend Next.js..."
NEXT_PUBLIC_API_URL="http://localhost:3001" npm run build

# ── 5. Variáveis de ambiente ─────────────────────────────
echo "[5/8] Configurando variáveis de ambiente..."
cat > $APP_DIR/backend/.env << EOF
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://$DOMAIN
EOF

cat > $APP_DIR/frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN
EOF

# ── 6. Nginx ─────────────────────────────────────────────
echo "[6/8] Configurando Nginx..."
cat > /etc/nginx/sites-available/nr13 << EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 50M;

    # Frontend Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend NestJS API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Uploads / Fotos
    location /uploads/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
EOF

ln -sf /etc/nginx/sites-available/nr13 /etc/nginx/sites-enabled/nr13
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 7. PM2 ───────────────────────────────────────────────
echo "[7/8] Iniciando aplicações com PM2..."
cd $APP_DIR
pm2 stop all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash 2>/dev/null || true

# ── 8. SSL (opcional) ────────────────────────────────────
echo "[8/8] Configurando SSL com Let's Encrypt..."
echo "  Para ativar HTTPS, execute:"
echo "  certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN"
echo ""

echo "=========================================="
echo "  DEPLOY CONCLUÍDO!"
echo "=========================================="
echo ""
echo "  Aplicação: http://$DOMAIN"
echo "  API:       http://$DOMAIN/api"
echo "  Banco:     $APP_DIR/data/nr13.sqlite"
echo "  Uploads:   $APP_DIR/uploads/"
echo "  Logs:      pm2 logs"
echo ""
echo "  Comandos úteis:"
echo "    pm2 status          # Status das apps"
echo "    pm2 logs            # Ver logs em tempo real"
echo "    pm2 restart all     # Reiniciar tudo"
echo "    pm2 monit           # Monitor visual"
echo ""
