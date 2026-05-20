# NR-13 — Sistema de Gestão de Inspeções de Vasos de Pressão

Stack: **NestJS** (backend) + **Next.js 14** (frontend) + **SQLite** (banco de dados)

---

## Estrutura do projeto

```
nr13-project/
├── backend/               # NestJS API
│   ├── src/
│   │   ├── database/      # DatabaseService (better-sqlite3)
│   │   └── modules/
│   │       ├── clientes/
│   │       ├── equipamentos/
│   │       ├── inspecoes/
│   │       ├── fotos/
│   │       ├── me/        # Medição de Espessura
│   │       └── relatorios/ # Geração de PDF (PDFKit)
│   ├── data/              # nr13.sqlite (criado automaticamente)
│   └── uploads/           # Fotos dos equipamentos
├── frontend/              # Next.js 14 (App Router)
│   └── src/
│       ├── app/           # Páginas (dashboard, clientes, equipamentos)
│       ├── components/    # Sidebar, forms reutilizáveis
│       ├── lib/           # api.ts, utils.ts
│       └── types/         # TypeScript interfaces
├── ecosystem.config.js    # PM2 — gerencia os dois processos
├── deploy.sh              # Deploy automático no VPS
├── update.sh              # Atualização sem downtime
└── backup.sh              # Backup diário do SQLite
```

---

## Rodando localmente

### Pré-requisitos
- Node.js 18+
- npm

### Backend

```bash
cd backend
npm install
npm run start:dev
# API em http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App em http://localhost:3000
```

---

## Deploy na Hostinger (VPS Ubuntu 22.04)

### 1. Enviar projeto para o servidor

```bash
# Via SCP
scp -r nr13-project/ root@SEU_IP:/tmp/nr13-project

# Ou via Git
git init && git add . && git commit -m "initial"
git remote add origin git@github.com:seu-usuario/nr13.git
git push -u origin main
# No servidor: git clone ...
```

### 2. Executar o script de deploy

```bash
ssh root@SEU_IP
cd /tmp/nr13-project
chmod +x deploy.sh
bash deploy.sh seu-dominio.com.br
```

O script instala automaticamente: Node.js, PM2, Nginx, configura proxy reverso e inicia as aplicações.

### 3. Ativar HTTPS (Let's Encrypt)

```bash
certbot --nginx -d seu-dominio.com.br --non-interactive --agree-tos -m admin@seu-dominio.com.br
```

### 4. Configurar backup automático

```bash
chmod +x /var/www/nr13/backup.sh
# Adicionar ao crontab (backup diário às 2h):
echo "0 2 * * * /var/www/nr13/backup.sh >> /var/www/nr13/logs/backup.log 2>&1" | crontab -
```

---

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/clientes | Listar clientes |
| POST | /api/clientes | Criar cliente |
| PATCH | /api/clientes/:id | Atualizar cliente |
| DELETE | /api/clientes/:id | Excluir cliente (cascade) |
| GET | /api/equipamentos | Listar equipamentos (filtro por clienteId) |
| GET | /api/equipamentos/vencimentos | Equipamentos com vencimento próximo |
| POST | /api/equipamentos | Criar equipamento |
| PATCH | /api/equipamentos/:id | Atualizar |
| DELETE | /api/equipamentos/:id | Excluir |
| GET | /api/inspecoes?equipamentoId= | Listar inspeções |
| POST | /api/inspecoes | Registrar inspeção |
| DELETE | /api/inspecoes/:id | Excluir |
| GET | /api/fotos?equipamentoId= | Listar fotos |
| POST | /api/fotos/upload | Upload de foto (multipart) |
| PATCH | /api/fotos/:id/legenda | Atualizar legenda |
| DELETE | /api/fotos/:id | Excluir foto |
| GET | /api/me?equipamentoId= | Listar medições ME |
| POST | /api/me | Salvar/atualizar medição ME |
| DELETE | /api/me/:id | Excluir |
| GET | /api/relatorios/pdf/:equipamentoId | **Gerar PDF R.I.S.E.** |

---

## Banco de dados (SQLite)

Tabelas criadas automaticamente na primeira execução:
- `clientes`
- `equipamentos` (FK → clientes, cascade delete)
- `inspecoes` (FK → equipamentos)
- `fotos` (FK → equipamentos)
- `medicoes_espessura` (FK → equipamentos)
- `pontos_me` (FK → medicoes_espessura)

O arquivo fica em `backend/data/nr13.sqlite`.

---

## Comandos PM2 úteis

```bash
pm2 status          # Status de todas as apps
pm2 logs            # Logs em tempo real
pm2 logs nr13-backend --lines 100
pm2 restart all     # Reiniciar tudo
pm2 reload all      # Reload sem downtime
pm2 monit           # Dashboard visual no terminal
```

---

## Atualizar o sistema

```bash
# No seu computador: enviar os novos arquivos
scp -r nr13-project/ root@SEU_IP:/tmp/nr13-project-new

# No servidor
cd /tmp/nr13-project-new
bash update.sh
```
