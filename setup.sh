#!/bin/bash
# ================================================================
# NR-13 — Setup local (primeira vez)
# Roda em: Linux, macOS, WSL
# ================================================================
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   NR-13 — Setup de desenvolvimento  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
echo ""

# Node.js
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}Node.js não encontrado. Instale em: https://nodejs.org${NC}"
  exit 1
fi
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${YELLOW}Node.js 18+ necessário. Versão atual: $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Instalar dependências
echo ""
echo "Instalando dependências do backend..."
cd backend && npm install && cd ..

echo ""
echo "Instalando dependências do frontend..."
cd frontend && npm install && cd ..

# Copiar .env
if [ ! -f backend/.env ]; then
  cat > backend/.env << EOF
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
EOF
  echo -e "${GREEN}✓ backend/.env criado${NC}"
fi

if [ ! -f frontend/.env.local ]; then
  cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
  echo -e "${GREEN}✓ frontend/.env.local criado${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Setup concluído!             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════╝${NC}"
echo ""
echo "  Para iniciar o sistema em desenvolvimento:"
echo ""
echo "  Terminal 1 (Backend):"
echo -e "    ${BLUE}cd backend && npm run start:dev${NC}"
echo ""
echo "  Terminal 2 (Frontend):"
echo -e "    ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo "  Ou com um único comando (requer concurrently):"
echo -e "    ${BLUE}npm install && npm run dev${NC}"
echo ""
echo "  URLs:"
echo "    Frontend: http://localhost:3000"
echo "    API:      http://localhost:3001/api"
echo ""
